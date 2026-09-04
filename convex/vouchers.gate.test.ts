/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";

const today = getSaoPauloDateKey();
const yesterday = getSaoPauloDateKey(
  new Date(Date.now() - 24 * 60 * 60 * 1000),
);

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as "pending" | "valid" | "redeemed" | "expired",
    visitDate: today,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
  };
}

async function insertVoucher(
  t: ReturnType<typeof createConvexTest>,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  const voucher = { ...defaults(), ...overrides };
  await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
  return voucher;
}

test("the gate list shows today's real vouchers and hides Test Vouchers", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "real", name: "Ana" });
  await insertVoucher(t, { code: "test", name: "Beto", isTest: true });
  await insertVoucher(t, { code: "gone", name: "Caio", visitDate: yesterday });

  const asEmployee = await withAuth(t, "employee");
  const list = await asEmployee.query(api.vouchers.listToday, {});

  expect(list.map((v) => v.code)).toEqual(["real"]);
});

test("a public caller cannot read the gate list", async () => {
  const t = createConvexTest();
  await insertVoucher(t);

  await expect(t.query(api.vouchers.listToday, {})).rejects.toThrow();
});

test("the admin gate list carries payment identifiers that listToday omits", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "real", name: "Ana", paymentId: "pay-1" });

  const asAdmin = await withAuth(t, "admin");
  const [employeeRow] = await asAdmin.query(api.vouchers.listToday, {});
  const [adminRow] = await asAdmin.query(api.vouchers.listTodayAdmin, {});

  expect(employeeRow && "paymentId" in employeeRow).toBe(false);
  expect(adminRow?.paymentId).toBe("pay-1");
  expect(adminRow?.preferenceId).toBe("pref-1");
});

test("an employee identity is rejected by listTodayAdmin", async () => {
  const t = createConvexTest();
  await insertVoucher(t);
  const asEmployee = await withAuth(t, "employee");

  await expect(
    asEmployee.query(api.vouchers.listTodayAdmin, {}),
  ).rejects.toThrow();
});

test("a public caller cannot read the admin gate list", async () => {
  const t = createConvexTest();
  await insertVoucher(t);

  await expect(t.query(api.vouchers.listTodayAdmin, {})).rejects.toThrow();
});

test("redeeming a valid voucher for today succeeds and is then terminal", async () => {
  const t = createConvexTest();
  await insertVoucher(t);
  const asEmployee = await withAuth(t, "employee");

  const result = await asEmployee.mutation(api.vouchers.redeemByCode, {
    code: "a1b2",
  });
  expect(result.status).toBe("redeemed");

  await expect(
    asEmployee.mutation(api.vouchers.redeemByCode, { code: "a1b2" }),
  ).rejects.toThrow(/já foi utilizado/);
});

test("redeeming a Test Voucher by code works even though it's hidden from the list", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "test", isTest: true });
  const asEmployee = await withAuth(t, "employee");

  const result = await asEmployee.mutation(api.vouchers.redeemByCode, {
    code: "test",
  });
  expect(result.status).toBe("redeemed");
});

test("redeeming a voucher outside today's operational window is refused", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { visitDate: yesterday });
  const asEmployee = await withAuth(t, "employee");

  await expect(
    asEmployee.mutation(api.vouchers.redeemByCode, { code: "a1b2" }),
  ).rejects.toThrow(/não é válido para o dia de hoje/);
});

test("redeeming a Pending voucher is refused", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { status: "pending" });
  const asEmployee = await withAuth(t, "employee");

  await expect(
    asEmployee.mutation(api.vouchers.redeemByCode, { code: "a1b2" }),
  ).rejects.toThrow();
});

test("a public caller cannot redeem", async () => {
  const t = createConvexTest();
  await insertVoucher(t);

  await expect(
    t.mutation(api.vouchers.redeemByCode, { code: "a1b2" }),
  ).rejects.toThrow();
});

test("reactivating moves expiresAt and leaves visitDate untouched", async () => {
  const t = createConvexTest();
  const originalExpiresAt = Date.now() - 1000 * 60 * 60 * 24;
  await insertVoucher(t, {
    status: "redeemed",
    visitDate: yesterday,
    expiresAt: originalExpiresAt,
  });
  const asEmployee = await withAuth(t, "employee");

  const result = await asEmployee.mutation(api.vouchers.reactivate, {
    code: "a1b2",
  });

  expect(result.status).toBe("valid");
  expect(result.expiresAt).toBeGreaterThan(originalExpiresAt);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("valid");
  expect(stored?.expiresAt).toBe(result.expiresAt);
  expect(stored?.visitDate).toBe(yesterday);
});

test("a public caller cannot reactivate", async () => {
  const t = createConvexTest();
  await insertVoucher(t);

  await expect(
    t.mutation(api.vouchers.reactivate, { code: "a1b2" }),
  ).rejects.toThrow();
});
