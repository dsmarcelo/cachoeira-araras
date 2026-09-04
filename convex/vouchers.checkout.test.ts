/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type * as voucherCodeModule from "./lib/voucherCode";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

interface CheckoutPreferenceStubInput {
  code: string;
}

interface CheckoutPreferenceStubResult {
  id: string;
  initPoint: string;
}

// Mercado Pago is stubbed at the module boundary (convex/lib/mercadopago.ts),
// per the testing decision in the migration spec: nothing else is stubbed,
// so checkout runs its real validation, code generation, and database work
// against convex-test's in-memory backend.
const createCheckoutPreference = vi.fn<
  (input: CheckoutPreferenceStubInput) => Promise<CheckoutPreferenceStubResult>
>();
vi.mock("./lib/mercadopago", () => ({
  createCheckoutPreference: (input: CheckoutPreferenceStubInput) =>
    createCheckoutPreference(input),
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
  createCheckoutPreference.mockReset();
  createCheckoutPreference.mockImplementation(
    async (input: { code: string }) => ({
      id: `pref-${input.code}`,
      initPoint: `https://mercadopago.example/${input.code}`,
    }),
  );

  codeSequence = 0;
  generateVoucherCode.mockReset();
  generateVoucherCode.mockImplementation(() => {
    codeSequence += 1;
    return `code${codeSequence}`;
  });
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

test("charges the server-derived price regardless of what a client sends", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  await asAdmin.mutation(api.settings.set, {
    key: "voucher.price",
    value: 5000,
  });

  const result = await t.action(api.vouchers.startCheckout, validArgs());

  expect(result.priceCents).toBe(10000);
  expect(createCheckoutPreference).toHaveBeenCalledWith(
    expect.objectContaining({ priceCents: 10000 }),
  );
});

test("a past visit date is refused with an actionable reason", async () => {
  const t = convexTest(schema, modules);
  const past = new Date("2020-01-01T12:00:00-03:00").getTime();

  await expect(
    t.action(api.vouchers.startCheckout, validArgs({ visitDateMs: past })),
  ).rejects.toThrow(/passado/);
  expect(createCheckoutPreference).not.toHaveBeenCalled();
});

test("a visit date beyond the booking window is refused with an actionable reason", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  await asAdmin.mutation(api.settings.set, {
    key: "max.intended.days",
    value: 5,
  });
  const farFuture = new Date("2030-01-01T12:00:00-03:00").getTime();

  await expect(
    t.action(
      api.vouchers.startCheckout,
      validArgs({ visitDateMs: farFuture }),
    ),
  ).rejects.toThrow(/limite permitido/);
});

test("a disabled day is refused with an actionable reason", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  const dateKey = "2026-09-10";
  await asAdmin.mutation(api.settings.set, {
    key: "disabled.days",
    value: [dateKey],
  });

  await expect(
    t.action(api.vouchers.startCheckout, validArgs()),
  ).rejects.toThrow(/indisponível/);
});

test("a phone that already holds a valid voucher is refused at checkout", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "abcd",
      name: "Outro Visitante",
      phone: "11999999999",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "valid",
      visitDate: "2026-09-01",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-existing",
      isTest: false,
    });
  });

  await expect(
    t.action(api.vouchers.startCheckout, validArgs()),
  ).rejects.toThrow(/já possui um voucher válido \(código abcd\)/);
  expect(createCheckoutPreference).not.toHaveBeenCalled();
});

test("quantity limits and per-entry-type toggles from settings are honoured", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  await asAdmin.mutation(api.settings.set, {
    key: "enable.voucher.buy",
    value: false,
  });

  await expect(
    t.action(api.vouchers.startCheckout, validArgs()),
  ).rejects.toThrow(/desativada/);
});

test("test mode is refused for an unauthenticated visitor", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.action(
      api.vouchers.startCheckout,
      validArgs({ testMode: true }),
    ),
  ).rejects.toThrow(/equipe autorizada/);
});

test("test mode charges one cent for a signed-in staff member", async () => {
  const t = convexTest(schema, modules);
  const asEmployee = t.withIdentity({ "properties.role": "employee" });

  const result = await asEmployee.action(
    api.vouchers.startCheckout,
    validArgs({ testMode: true }),
  );

  expect(result.priceCents).toBe(1);
});

test("the voucher is left Pending with visitDate set to the day the customer chose", async () => {
  const t = convexTest(schema, modules);

  const result = await t.action(api.vouchers.startCheckout, validArgs());

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
  const t = convexTest(schema, modules);

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

  const result = await t.action(api.vouchers.startCheckout, validArgs());

  // The loser (this checkout) gets a different code rather than an error.
  expect(result.code).not.toBe("code1");
  expect(generateVoucherCode).toHaveBeenCalledTimes(2);
  expect(createCheckoutPreference).toHaveBeenCalledTimes(2);

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
