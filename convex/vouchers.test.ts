/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function baseVoucher(overrides: Partial<{ deletedAt: number } & ReturnType<typeof defaults>> = {}) {
  return { ...defaults(), ...overrides };
}

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 2,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as const,
    visitDate: "2026-09-10",
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    isTest: false,
    deletedAt: undefined as number | undefined,
  };
}

async function insertVoucher(
  t: ReturnType<typeof convexTest>,
  voucher: ReturnType<typeof baseVoucher>,
) {
  return t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
}

test("returns status for a valid code with no session", async () => {
  const t = convexTest(schema, modules);
  const voucher = baseVoucher();
  await insertVoucher(t, voucher);

  const result = await t.query(api.vouchers.getByCode, { code: "a1b2" });
  expect(result).toEqual({
    code: "a1b2",
    status: "valid",
    visitDate: "2026-09-10",
    expiresAt: voucher.expiresAt,
    adults: 2,
    elderly: 0,
    adultsPool: 2,
    elderlyPool: 0,
  });
});

test("an unknown code reports not-found rather than erroring", async () => {
  const t = convexTest(schema, modules);

  const result = await t.query(api.vouchers.getByCode, { code: "zzzz" });
  expect(result).toBeNull();
});

test("a soft-deleted voucher is not returned", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, baseVoucher({ code: "gone", deletedAt: Date.now() }));

  const result = await t.query(api.vouchers.getByCode, { code: "gone" });
  expect(result).toBeNull();
});

test("a Test Voucher is returned when fetched by its code", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, baseVoucher({ code: "test", isTest: true }));

  const result = await t.query(api.vouchers.getByCode, { code: "test" });
  expect(result).toMatchObject({ code: "test", status: "valid" });
});

test("the response carries no buyer PII or internal identifiers", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, baseVoucher());

  const result = await t.query(api.vouchers.getByCode, { code: "a1b2" });
  expect(result).not.toHaveProperty("name");
  expect(result).not.toHaveProperty("phone");
  expect(result).not.toHaveProperty("priceCents");
  expect(result).not.toHaveProperty("preferenceId");
  expect(result).not.toHaveProperty("paymentId");
});
