/// <reference types="vite/client" />
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let fake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof fake.api.findPaymentsByExternalReference>
  ) => fake.api.findPaymentsByExternalReference(...args),
}));

beforeEach(() => {
  fake = createMercadoPagoFake();
});

function pendingVoucher(code: string, managementToken: string) {
  return {
    code,
    managementToken,
    name: "Visitante",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 7000,
    status: "pending" as const,
    visitDate: "2026-10-01",
    expiresAt: Date.now() + 86_400_000,
    preferenceId: `pref-${code}`,
    isTest: false,
  };
}

test("the saved purchase confirms an approved payment and limits repeated checks", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("BUY01", "owner-token"));
  });
  fake.payments.set("pay-1", {
    id: "pay-1",
    status: "approved",
    externalReference: "BUY01",
    amount: 70,
    refundedAmount: 0,
  });

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "BUY01",
      managementToken: "wrong-token",
    }),
  ).toBe("skipped");
  expect(fake.attempts).toHaveLength(0);

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "BUY01",
      managementToken: "owner-token",
    }),
  ).toBe("updated");
  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "BUY01",
      managementToken: "owner-token",
    }),
  ).toBe("skipped");
  expect(fake.attempts.filter((attempt) => attempt.kind === "search")).toHaveLength(1);

  const voucher = await t.run((ctx) =>
    ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "BUY01")).unique(),
  );
  expect(voucher?.status).toBe("valid");
  expect(voucher?.paymentId).toBe("pay-1");
});

test("the admin table can reconcile pending vouchers, but an anonymous caller cannot", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("ADMIN01", "owner-token"));
  });
  fake.payments.set("pay-2", {
    id: "pay-2",
    status: "approved",
    externalReference: "ADMIN01",
    amount: 70,
    refundedAmount: 0,
  });

  await expect(
    t.action(api.voucherReconciliation.reconcileAdmin, { codes: ["ADMIN01"] }),
  ).rejects.toThrow(/401/);
  expect(fake.attempts).toHaveLength(0);

  const admin = await withAuth(t, "admin");
  expect(
    await admin.action(api.voucherReconciliation.reconcileAdmin, { codes: ["ADMIN01"] }),
  ).toEqual({ updated: 1, failed: 0 });
});

test("a failed provider search is retried through the same recorded operation", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("RETRY01", "owner-token"));
  });
  fake.respondWith("search", "transientFailure");

  await expect(
    t.action(api.voucherReconciliation.reconcileMine, {
      code: "RETRY01",
      managementToken: "owner-token",
    }),
  ).rejects.toThrow(/Transient provider failure/);

  await t.run(async (ctx) => {
    const voucher = await ctx.db.query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "RETRY01"))
      .unique();
    if (!voucher) throw new Error("Test voucher missing");
    await ctx.db.patch(voucher._id, { paymentReconciliationCheckedAt: 0 });
  });

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "RETRY01",
      managementToken: "owner-token",
    }),
  ).toBe("checked");
  const operations = await t.run((ctx) => ctx.db.query("paymentOperations").collect());
  expect(operations).toHaveLength(1);
  expect(operations[0]?.result).toEqual([]);
});
