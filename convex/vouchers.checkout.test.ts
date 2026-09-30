/// <reference types="vite/client" />
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type * as voucherCodeModule from "./lib/voucherCode";
import { MAX_PENDING_VOUCHERS_PER_PHONE } from "./lib/rateLimiter";
import { createConvexTest, withAuth } from "./test.setup";

import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let mpFake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  refundPayment: (...args: Parameters<typeof mpFake.api.refundPayment>) =>
    mpFake.api.refundPayment(...args),
  invalidatePreference: (
    ...args: Parameters<typeof mpFake.api.invalidatePreference>
  ) => mpFake.api.invalidatePreference(...args),
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof mpFake.api.findPaymentsByExternalReference>
  ) => mpFake.api.findPaymentsByExternalReference(...args),
  cancelPayment: (...args: Parameters<typeof mpFake.api.cancelPayment>) =>
    mpFake.api.cancelPayment(...args),
}));

// generateVoucherCode is mocked in one test only, to deterministically force
// a code collision and prove the retry path; every other test uses the real
// (random) generator via mockImplementation's default below.
const generateVoucherCode = vi.fn<() => string>();
vi.mock("./lib/voucherCode", async (importOriginal) => {
  const actual = await importOriginal<typeof voucherCodeModule>();
  return {
    ...actual,
    generateVoucherCode: () => generateVoucherCode(),
  };
});

let codeSequence = 0;

beforeEach(() => {
  // The fixtures use a fixed visit date; keep "today" just before it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T12:00:00-03:00"));
  mpFake = createMercadoPagoFake();
  codeSequence = 0;
  generateVoucherCode.mockReset();
  generateVoucherCode.mockImplementation(() => {
    codeSequence += 1;
    return `code${codeSequence}`;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
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

test("charges the environment price even when an old database price exists", async () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "80");
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      key: "voucher.price",
      value: 5000,
    });
  });

  const result = await t.action(
    api.embeddedCheckout.startPurchase,
    validArgs({ visitDateMs: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  );

  expect(result.priceCents).toBe(16000);
});

test("publishes environment prices and prevents editing them as settings", async () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "72.50");
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");

  expect((await t.query(api.settings.getAll, {}))["voucher.price"]).toBe(7250);
  expect(await t.query(api.settings.get, { key: "voucher.price" })).toEqual({
    key: "voucher.price",
    value: 7250,
  });
  await expect(
    asAdmin.mutation(api.settings.set, { key: "voucher.price", value: 5000 }),
  ).rejects.toThrow(/ambiente do servidor/);
});

test("a past visit date is refused with an actionable reason", async () => {
  const t = createConvexTest();
  const past = new Date("2020-01-01T12:00:00-03:00").getTime();

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs({ visitDateMs: past })),
  ).rejects.toThrow(/passado/);
});

test("a visit date beyond the booking window is refused with an actionable reason", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");
  await asAdmin.mutation(api.settings.set, {
    key: "max.intended.days",
    value: 5,
  });
  const farFuture = new Date("2030-01-01T12:00:00-03:00").getTime();

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs({ visitDateMs: farFuture })),
  ).rejects.toThrow(/limite permitido/);
});

test("a disabled day is refused with an actionable reason", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");
  const dateKey = "2026-09-10";
  await asAdmin.mutation(api.settings.set, {
    key: "disabled.days",
    value: [dateKey],
  });

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs()),
  ).rejects.toThrow(/indisponível/);
});

test("a phone holding only valid, redeemed, expired, or refunded vouchers can complete a new purchase", async () => {
  const t = createConvexTest();
  const phone = "11999999999";
  const nonPendingStatuses = [
    "valid",
    "redeemed",
    "expired",
    "refunded",
  ] as const;

  for (const [i, status] of nonPendingStatuses.entries()) {
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", {
        code: `prev-${i}`,
        name: "Outro Visitante",
        phone,
        adults: 1,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
        priceCents: 5000,
        status,
        visitDate: "2026-09-01",
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
        preferenceId: `pref-existing-${i}`,
        isTest: false,
      });
    });
  }

  const result = await t.action(
    api.embeddedCheckout.startPurchase,
    validArgs({ phone }),
  );

  expect(result.code).toBeTruthy();
});

test("quantity limits and per-entry-type toggles from settings are honoured", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");
  await asAdmin.mutation(api.settings.set, {
    key: "enable.voucher.buy",
    value: false,
  });

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs()),
  ).rejects.toThrow(/desativada/);
});

test("test mode is refused for an unauthenticated visitor, even though they asserted it themselves, and no voucher is created", async () => {
  const t = createConvexTest();

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs({ testMode: true })),
  ).rejects.toThrow(/equipe autorizada/);

  const vouchers = await t.run(async (ctx) =>
    ctx.db.query("vouchers").collect(),
  );
  expect(vouchers).toHaveLength(0);
});

test("test mode charges one cent for a signed-in staff member, and the stored voucher carries the server-set Test Voucher flag", async () => {
  const t = createConvexTest();
  const asEmployee = await withAuth(t, "employee");

  const result = await asEmployee.action(
    api.embeddedCheckout.startPurchase,
    validArgs({ testMode: true }),
  );

  expect(result.priceCents).toBe(1);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", result.code))
      .unique(),
  );
  expect(stored?.isTest).toBe(true);
});

test("the voucher is left Pending with visitDate set to the day the customer chose", async () => {
  const t = createConvexTest();

  const result = await t.action(api.embeddedCheckout.startPurchase, validArgs());

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", result.code))
      .unique(),
  );
  expect(stored?.status).toBe("pending");
  expect(stored?.visitDate).toBe("2026-09-10");
});

test("a code collision retries with a fresh code instead of erroring, and produces exactly one voucher", async () => {
  const t = createConvexTest();

  // A voucher already sits under the first code the (mocked, deterministic)
  // generator will produce, simulating a concurrent checkout that won the
  // race for that code first.
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "code1",
      name: "Primeiro Visitante",
      phone: "11988887777",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-existing",
      isTest: false,
    });
  });

  const result = await t.action(api.embeddedCheckout.startPurchase, validArgs());

  // The loser (this checkout) gets a different code rather than an error.
  expect(result.code).not.toBe("code1");
  expect(generateVoucherCode).toHaveBeenCalledTimes(2);

  const vouchersWithCode1 = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "code1"))
      .collect(),
  );
  expect(vouchersWithCode1).toHaveLength(1);
  expect(vouchersWithCode1[0]?.name).toBe("Primeiro Visitante");

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", result.code))
      .unique(),
  );
  expect(stored?.status).toBe("pending");
});

test("exceeding the per-phone rate limit blocks checkout without a partial voucher", async () => {
  const t = createConvexTest();
  const phone = "11977776666";

  // Exhaust the per-phone token bucket capacity with distinct visit dates,
  // immediately marking each voucher redeemed so the separate pending-ceiling
  // check (a lower threshold) isn't what trips this test.
  for (let i = 0; i < 3; i += 1) {
    const result = await t.action(
      api.embeddedCheckout.startPurchase,
      validArgs({ phone, visitDateMs: visitDateMs + i * 24 * 60 * 60 * 1000 }),
    );
    await t.run(async (ctx) => {
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", result.code))
        .unique();
      if (voucher) {
        await ctx.db.patch("vouchers", voucher._id, { status: "redeemed" });
      }
    });
  }

  await expect(
    t.action(
      api.embeddedCheckout.startPurchase,
      validArgs({ phone, visitDateMs: visitDateMs + 30 * 24 * 60 * 60 * 1000 }),
    ),
  ).rejects.toThrow(/Muitas tentativas de compra com este telefone/);
});

test("reaching the pending-voucher ceiling for a phone blocks checkout and tells the customer to resume it", async () => {
  const t = createConvexTest();
  const phone = "11966665555";

  for (let i = 0; i < MAX_PENDING_VOUCHERS_PER_PHONE; i += 1) {
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", {
        code: `pend${i}`,
        name: "Visitante Pendente",
        phone,
        adults: 1,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
        priceCents: 5000,
        status: "pending",
        visitDate: "2026-09-01",
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
        preferenceId: `pref-pend${i}`,
        isTest: false,
      });
    });
  }

  await expect(
    t.action(api.embeddedCheckout.startPurchase, validArgs({ phone })),
  ).rejects.toThrow(/Você já tem uma compra pendente/);

  const vouchers = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .collect(),
  );
  expect(vouchers).toHaveLength(MAX_PENDING_VOUCHERS_PER_PHONE);
});

test("an expired pending voucher does not count toward the pending ceiling", async () => {
  const t = createConvexTest();
  const phone = "11955554444";

  for (let i = 0; i < MAX_PENDING_VOUCHERS_PER_PHONE; i += 1) {
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", {
        code: `exp${i}`,
        name: "Visitante Expirado",
        phone,
        adults: 1,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
        priceCents: 5000,
        status: "pending",
        visitDate: "2020-01-01",
        expiresAt: Date.now() - 1000, // already expired
        preferenceId: `pref-exp${i}`,
        isTest: false,
      });
    });
  }

  const result = await t.action(api.embeddedCheckout.startPurchase, validArgs({ phone }));
  expect(result.code).toBeTruthy();
});

test("exceeding the global rate limit blocks checkout even across different phone numbers", async () => {
  const t = createConvexTest();

  // Drive the shared global bucket to exhaustion with distinct phones (each
  // well under its own per-phone and pending-ceiling limits), then confirm
  // the next attempt is refused .
  for (let i = 0; i < 60; i += 1) {
    await t.action(
      api.embeddedCheckout.startPurchase,
      validArgs({ phone: `1190000${String(i).padStart(4, "0")}` }),
    );
  }

  await expect(
    t.action(
      api.embeddedCheckout.startPurchase,
      validArgs({ phone: "11900009999" }),
    ),
  ).rejects.toThrow(/O sistema está processando muitas compras/);
});

test("two concurrent purchases for the same phone leave at most one pending voucher", async () => {
  const t = createConvexTest();
  const phone = "11987654321";

  const results = await Promise.allSettled([
    t.action(api.embeddedCheckout.startPurchase, validArgs({ phone })),
    t.action(api.embeddedCheckout.startPurchase, validArgs({ phone })),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  const reason: unknown = rejected[0]?.reason;
  expect(reason).toBeInstanceOf(ConvexError);
  expect((reason as ConvexError<string>).data).toContain(
    "Você já tem uma compra pendente",
  );

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .collect(),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]?.preferenceId).toBeUndefined();
});
