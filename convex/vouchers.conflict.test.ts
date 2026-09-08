/// <reference types="vite/client" />
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createConvexTest } from "./test.setup";

interface CheckoutPreferenceStubInput {
  code: string;
}

interface CheckoutPreferenceStubResult {
  id: string;
  initPoint: string;
}

const createCheckoutPreference =
  vi.fn<
    (
      input: CheckoutPreferenceStubInput,
    ) => Promise<CheckoutPreferenceStubResult>
  >();
vi.mock("./lib/mercadopago", () => ({
  createCheckoutPreference: (input: CheckoutPreferenceStubInput) =>
    createCheckoutPreference(input),
}));

beforeEach(() => {
  createCheckoutPreference.mockReset();
  createCheckoutPreference.mockImplementation(
    async (input: { code: string }) => ({
      id: `pref-${input.code}`,
      initPoint: `https://mercadopago.example/${input.code}`,
    }),
  );
});

const visitDateMs = new Date("2026-09-10T12:00:00-03:00").getTime();

function validArgs(overrides: Record<string, unknown> = {}) {
  return {
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    visitDateMs,
    ...overrides,
  };
}

test("checkout returns an opaque, high-entropy management capability stored on the voucher", async () => {
  const t = createConvexTest();

  const checkout = await t.action(api.vouchers.startCheckout, validArgs());

  expect(checkout.managementToken).toBeTruthy();
  // Validates high-entropy UUID v4 format
  expect(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      checkout.managementToken,
    ),
  ).toBe(true);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", checkout.code))
      .unique(),
  );

  expect(stored?.managementToken).toBe(checkout.managementToken);
  // It cannot be derived or recovered from phone or code
  expect(checkout.managementToken).not.toContain(checkout.code);
  expect(checkout.managementToken).not.toContain(validArgs().phone);
});

test("with a valid capability, a blocked purchase shows Voucher Code, Visit Date, quantities, price, and status", async () => {
  const t = createConvexTest();
  const phone = "11999991111";
  const managementToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "PEND01",
      managementToken,
      name: "Visitante Autorizado",
      phone,
      adults: 2,
      elderly: 1,
      adultsPool: 1,
      elderlyPool: 0,
      priceCents: 15000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-pend01",
      isTest: false,
    });
  });

  const conflict = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [managementToken],
  });

  expect(conflict.kind).toBe("authorized");
  if (conflict.kind !== "authorized") throw new Error("Expected authorized conflict");

  expect(conflict.vouchers).toHaveLength(1);
  const voucher = conflict.vouchers[0]!;
  expect(voucher.code).toBe("PEND01");
  expect(voucher.visitDate).toBe("2026-09-10");
  expect(voucher.adults).toBe(2);
  expect(voucher.elderly).toBe(1);
  expect(voucher.adultsPool).toBe(1);
  expect(voucher.elderlyPool).toBe(0);
  expect(voucher.priceCents).toBe(15000);
  expect(voucher.status).toBe("pending");
  expect(voucher.actions).toEqual({
    canResume: true,
    canCancel: true,
  });
});

test("without a valid capability, the response reveals only that a pending purchase exists and directs the visitor to the original browser", async () => {
  const t = createConvexTest();
  const phone = "11999992222";
  const realToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "PEND02",
      managementToken: realToken,
      name: "Outro Visitante",
      phone,
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-pend02",
      isTest: false,
    });
  });

  // Query with empty management tokens
  const conflictEmpty = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [],
  });

  expect(conflictEmpty.kind).toBe("generic");
  if (conflictEmpty.kind === "generic") {
    expect(conflictEmpty.message).toContain("Você já tem uma compra pendente com este telefone");
    expect(conflictEmpty.message).toContain("navegador onde a compra foi iniciada");
    expect(conflictEmpty).not.toHaveProperty("vouchers");
  }

  // Query with wrong management tokens
  const conflictWrong = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [crypto.randomUUID()],
  });

  expect(conflictWrong.kind).toBe("generic");
});

test("knowing a phone number or Voucher Code grants no access to the authorised summary or its actions", async () => {
  const t = createConvexTest();
  const phone = "11999993333";
  const code = "SECRET01";
  const realToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code,
      managementToken: realToken,
      name: "Visitante Alvo",
      phone,
      adults: 3,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 15000,
      status: "pending",
      visitDate: "2026-09-11",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-secret",
      isTest: false,
    });
  });

  // Attempting to pass the Voucher Code as a management capability
  const attackerAttempt = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [code],
  });

  expect(attackerAttempt.kind).toBe("generic");
  expect(attackerAttempt).not.toHaveProperty("vouchers");

  // Public lookup by code returns only the public read view, without management actions
  const lookupAuth = await t.mutation(api.vouchers.authorizeLookup, { code });
  expect(lookupAuth.kind).toBe("authorized");
  if (lookupAuth.kind === "authorized") {
    expect(lookupAuth).not.toHaveProperty("managementToken");
    expect(lookupAuth.voucher).not.toHaveProperty("actions");

    const authorizedRead = await t.query(api.vouchers.getAuthorized, {
      lookupToken: lookupAuth.lookupToken,
    });
    expect(authorizedRead).not.toHaveProperty("managementToken");
    expect(authorizedRead).not.toHaveProperty("actions");
  }
});

test("when the browser knows several pending purchases for the phone, all of them are listed, each with its own actions", async () => {
  const t = createConvexTest();
  const phone = "11999994444";
  const token1 = crypto.randomUUID();
  const token2 = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "MULTI01",
      managementToken: token1,
      name: "Visitante Múltiplo 1",
      phone,
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-multi-1",
      isTest: false,
    });

    await ctx.db.insert("vouchers", {
      code: "MULTI02",
      managementToken: token2,
      name: "Visitante Múltiplo 2",
      phone,
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 10000,
      status: "pending",
      visitDate: "2026-09-12",
      expiresAt: Date.now() + 1000 * 60 * 60 * 48,
      preferenceId: "pref-multi-2",
      isTest: false,
    });
  });

  const conflict = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [token1, token2],
  });

  expect(conflict.kind).toBe("authorized");
  if (conflict.kind !== "authorized") throw new Error("Expected authorized conflict");

  expect(conflict.vouchers).toHaveLength(2);
  const codes = conflict.vouchers.map((v) => v.code);
  expect(codes).toContain("MULTI01");
  expect(codes).toContain("MULTI02");

  for (const v of conflict.vouchers) {
    expect(v.actions).toEqual({
      canResume: true,
      canCancel: true,
    });
  }
});

test("the dialog query reflects backend state changes made in another tab without a manual reload", async () => {
  const t = createConvexTest();
  const phone = "11999995555";
  const token = crypto.randomUUID();

  let voucherId: Id<"vouchers">;
  await t.run(async (ctx) => {
    voucherId = await ctx.db.insert("vouchers", {
      code: "REACT01",
      managementToken: token,
      name: "Visitante Reativo",
      phone,
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 10000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-react",
      isTest: false,
    });
  });

  // Initially pending
  const initial = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [token],
  });
  expect(initial.kind).toBe("authorized");
  if (initial.kind !== "authorized") throw new Error("Expected authorized");
  expect(initial.vouchers[0]?.status).toBe("pending");
  expect(initial.vouchers[0]?.actions.canResume).toBe(true);
  expect(initial.vouchers[0]?.actions.canCancel).toBe(true);

  // Simulate tab 2 payment approval
  await t.run(async (ctx) => {
    await ctx.db.patch(voucherId, { status: "valid" });
  });

  // Query dynamically reflects the new backend state
  const afterPayment = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [token],
  });
  expect(afterPayment.kind).toBe("authorized");
  if (afterPayment.kind !== "authorized") throw new Error("Expected authorized");
  expect(afterPayment.vouchers[0]?.status).toBe("valid");
  expect(afterPayment.vouchers[0]?.actions.canResume).toBe(false);
  expect(afterPayment.vouchers[0]?.actions.canCancel).toBe(false);

  // When past expiry, canResume is disabled
  await t.run(async (ctx) => {
    await ctx.db.patch(voucherId, {
      status: "pending",
      expiresAt: Date.now() - 1000,
    });
  });

  const afterExpiry = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [token],
  });
  expect(afterExpiry.kind).toBe("authorized");
  if (afterExpiry.kind !== "authorized") throw new Error("Expected authorized");
  expect(afterExpiry.vouchers[0]?.actions.canResume).toBe(false);
});

test("the authorised summary contains no payment or preference identifiers", async () => {
  const t = createConvexTest();
  const phone = "11999996666";
  const token = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "NOPAYID",
      managementToken: token,
      name: "Visitante Sem Id",
      phone,
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "mercado-pago-preference-secret-123",
      paymentId: "mercado-pago-payment-secret-456",
      isTest: false,
    });
  });

  const conflict = await t.query(api.vouchers.getPendingConflict, {
    phone,
    managementTokens: [token],
  });

  expect(conflict.kind).toBe("authorized");
  if (conflict.kind !== "authorized") throw new Error("Expected authorized");

  const voucher = conflict.vouchers[0]!;
  expect(voucher).not.toHaveProperty("preferenceId");
  expect(voucher).not.toHaveProperty("paymentId");
  expect(voucher).not.toHaveProperty("initPoint");

  const rawJson = JSON.stringify(conflict);
  expect(rawJson).not.toContain("mercado-pago-preference-secret-123");
  expect(rawJson).not.toContain("mercado-pago-payment-secret-456");
});
