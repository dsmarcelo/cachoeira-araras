/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const today = getSaoPauloDateKey();

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
  t: ReturnType<typeof convexTest>,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  const voucher = { ...defaults(), ...overrides };
  await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
  return voucher;
}

test("the admin list excludes Test Vouchers", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "real", name: "Ana" });
  await insertVoucher(t, { code: "test", name: "Beto", isTest: true });
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  const list = await asAdmin.query(api.vouchers.listAdmin, {});

  expect(list.map((v) => v.code)).toEqual(["real"]);
});

test("the admin list narrows by status", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "a", status: "valid" });
  await insertVoucher(t, { code: "b", status: "pending" });
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  const list = await asAdmin.query(api.vouchers.listAdmin, {
    status: "pending",
  });

  expect(list.map((v) => v.code)).toEqual(["b"]);
});

test("the admin list narrows by creation-date range", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "in-range" });
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  const now = Date.now();
  const withinRange = await asAdmin.query(api.vouchers.listAdmin, {
    createdAfter: now - 1000,
    createdBefore: now + 1000,
  });
  const outsideRange = await asAdmin.query(api.vouchers.listAdmin, {
    createdAfter: now + 1000,
  });

  expect(withinRange.map((v) => v.code)).toEqual(["in-range"]);
  expect(outsideRange).toEqual([]);
});

test("an employee identity is rejected by every admin voucher function, including with a forged role argument", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);
  const asEmployee = t.withIdentity({ "properties.role": "employee" });
  // `role` isn't a real arg on any of these functions, but a caller could
  // still try to smuggle one in; Convex's arg validators reject an unknown
  // key like this outright, and the handlers never read a client-supplied
  // role in the first place.
  const forged = { role: "admin" } as unknown as Record<string, never>;

  await expect(
    asEmployee.query(api.vouchers.listAdmin, forged),
  ).rejects.toThrow();
  await expect(
    asEmployee.query(api.vouchers.listDeleted, forged),
  ).rejects.toThrow();
  await expect(
    asEmployee.mutation(api.vouchers.updateStatus, {
      code: "a1b2",
      status: "expired",
      ...forged,
    }),
  ).rejects.toThrow();
  await expect(
    asEmployee.mutation(api.vouchers.softDelete, { code: "a1b2", ...forged }),
  ).rejects.toThrow();
  await expect(
    asEmployee.mutation(api.vouchers.restore, { code: "a1b2", ...forged }),
  ).rejects.toThrow();
});

test("a public caller is rejected by every admin voucher function", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  await expect(t.query(api.vouchers.listAdmin, {})).rejects.toThrow();
  await expect(t.query(api.vouchers.listDeleted, {})).rejects.toThrow();
  await expect(
    t.mutation(api.vouchers.updateStatus, { code: "a1b2", status: "expired" }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.vouchers.softDelete, { code: "a1b2" }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.vouchers.restore, { code: "a1b2" }),
  ).rejects.toThrow();
});

test("editing a voucher's status persists it", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { status: "pending" });
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  await asAdmin.mutation(api.vouchers.updateStatus, {
    code: "a1b2",
    status: "valid",
  });

  const [row] = await asAdmin.query(api.vouchers.listAdmin, {});
  expect(row?.status).toBe("valid");
});

test("soft-deleting removes a voucher from the main list and surfaces it in the deleted view; restoring reverses both", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "a1b2" });
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  await asAdmin.mutation(api.vouchers.softDelete, { code: "a1b2" });

  expect(await asAdmin.query(api.vouchers.listAdmin, {})).toEqual([]);
  const deletedList = await asAdmin.query(api.vouchers.listDeleted, {});
  expect(deletedList.map((v) => v.code)).toEqual(["a1b2"]);

  await asAdmin.mutation(api.vouchers.restore, { code: "a1b2" });

  const restoredList = await asAdmin.query(api.vouchers.listAdmin, {});
  expect(restoredList.map((v) => v.code)).toEqual(["a1b2"]);
  expect(await asAdmin.query(api.vouchers.listDeleted, {})).toEqual([]);
});
