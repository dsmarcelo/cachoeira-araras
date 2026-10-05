/// <reference types="vite/client" />
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type * as adapter from "./lib/mercadopagoOperations";
import { createConvexTest, withAuth } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let fake: ReturnType<typeof createMercadoPagoFake>;
let paymentFetches: string[];
// Real `chargebackOutcome` is pure, so only the provider reads are faked.
vi.mock("./lib/mercadopagoOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof adapter>()),
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof fake.api.findPaymentsByExternalReference>
  ) => fake.api.findPaymentsByExternalReference(...args),
  getPayment: (...args: Parameters<typeof fake.api.getPayment>) => {
    paymentFetches.push(args[0]);
    return fake.api.getPayment(...args);
  },
  findChargebacksByPayment: (paymentId: string) =>
    fake.api.findChargebacksByPayment(paymentId),
}));

beforeEach(() => {
  fake = createMercadoPagoFake();
  paymentFetches = [];
});

const baseVoucher = (code: string) => ({
  code,
  managementToken: `manage-${code}`,
  lookupToken: `lookup-${code}`,
  name: "Visitante",
  phone: "11999999999",
  adults: 1,
  elderly: 0,
  adultsPool: 0,
  elderlyPool: 0,
  priceCents: 7000,
  visitDate: "2026-10-01",
  expiresAt: Date.now() + 86_400_000,
  preferenceId: `pref-${code}`,
  isTest: false,
});

const pendingVoucher = (code: string) => ({
  ...baseVoucher(code),
  status: "pending" as const,
});

const chargebackCase = (coverageApplied: boolean | null) => ({
  id: "cb-1",
  coverageApplied,
  dateCreated: "2026-10-01T00:00:00Z",
  dateLastUpdated: "2026-10-02T00:00:00Z",
});

type Overrides = Partial<Pick<Doc<"vouchers">, "status" | "reversal">>;

/** A paid voucher with its Official Payment on file and in the fake provider. */
async function paidSetup(
  providerPayment: { status: string; statusDetail?: string } = {
    status: "approved",
    statusDetail: "accredited",
  },
  overrides: Overrides = {},
) {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      ...baseVoucher("PAID01"),
      status: "valid",
      paymentId: "pay-paid",
      ...overrides,
    });
    await ctx.db.insert("payments", {
      paymentId: "pay-paid",
      voucherCode: "PAID01",
      status: "approved",
      statusDetail: "accredited",
      isOfficial: true,
      owesRefund: false,
      createdAt: Date.now(),
    });
  });
  fake.payments.set("pay-paid", {
    id: "pay-paid",
    externalReference: "PAID01",
    amount: 70,
    refundedAmount: 0,
    ...providerPayment,
  });
  return t;
}

type TestConvex = ReturnType<typeof createConvexTest>;

const reload = (t: TestConvex, code = "PAID01") =>
  t.run((ctx) =>
    ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", code)).unique(),
  );

/** Lifts the one-minute throttle so the next check reaches the provider. */
const liftThrottle = (t: TestConvex, code = "PAID01") =>
  t.run(async (ctx) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!voucher) throw new Error("Test voucher missing");
    await ctx.db.patch(voucher._id, { paymentReconciliationCheckedAt: 0 });
  });

test("the saved purchase confirms an approved payment and limits repeated checks", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("BUY01"));
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
      managementToken: "manage-BUY01",
    }),
  ).toBe("updated");
  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "BUY01",
      managementToken: "manage-BUY01",
    }),
  ).toBe("skipped");
  expect(fake.attempts.filter((attempt) => attempt.kind === "search")).toHaveLength(1);

  const voucher = await reload(t, "BUY01");
  expect(voucher?.status).toBe("valid");
  expect(voucher?.paymentId).toBe("pay-1");
});

test("a failed pending search reports failed and is retried through the same recorded operation", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("RETRY01"));
  });
  fake.respondWith("search", "transientFailure");

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "RETRY01",
      managementToken: "manage-RETRY01",
    }),
  ).toBe("failed");
  await liftThrottle(t, "RETRY01");

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "RETRY01",
      managementToken: "manage-RETRY01",
    }),
  ).toBe("checked");
  const operations = await t.run((ctx) => ctx.db.query("paymentOperations").collect());
  expect(operations).toHaveLength(1);
  expect(operations[0]?.result).toEqual([]);
});

test("a paid voucher is re-checked at most once a minute", async () => {
  const t = await paidSetup();
  const check = () =>
    t.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      managementToken: "manage-PAID01",
    });

  expect(await check()).toBe("checked");
  expect(await check()).toBe("skipped");
  expect(paymentFetches).toEqual(["pay-paid"]);

  await liftThrottle(t);
  expect(await check()).toBe("checked");
  expect(paymentFetches).toHaveLength(2);
});

test("customers are authorized by the management token or the lookup token, never another", async () => {
  const t = await paidSetup();
  const mine = (args: { managementToken?: string; lookupToken?: string }) =>
    t.action(api.voucherReconciliation.reconcileMine, { code: "PAID01", ...args });

  expect(await mine({})).toBe("skipped");
  expect(await mine({ managementToken: "lookup-PAID01" })).toBe("skipped");
  expect(await mine({ lookupToken: "manage-PAID01" })).toBe("skipped");
  expect(await mine({ lookupToken: "" })).toBe("skipped");
  expect(paymentFetches).toHaveLength(0);

  expect(await mine({ lookupToken: "lookup-PAID01" })).toBe("checked");
  await liftThrottle(t);
  expect(await mine({ managementToken: "manage-PAID01" })).toBe("checked");
  expect(paymentFetches).toHaveLength(2);
});

test("a voucher without a lookup token cannot be reached with an arbitrary one", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    const legacy = { ...baseVoucher("LEGACY"), lookupToken: undefined };
    await ctx.db.insert("vouchers", { ...legacy, status: "valid", paymentId: "pay-l" });
  });

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "LEGACY",
      lookupToken: "undefined",
    }),
  ).toBe("skipped");
  expect(paymentFetches).toHaveLength(0);
});

test("the gate check is open to employees and admins only, and the admin batch to admins only", async () => {
  const t = await paidSetup();

  await expect(
    t.action(api.voucherReconciliation.reconcileAtGate, { code: "PAID01" }),
  ).rejects.toThrow(/401/);
  await expect(
    t.action(api.voucherReconciliation.reconcileAdmin, { codes: ["PAID01"] }),
  ).rejects.toThrow(/401/);

  const employee = await withAuth(t, "employee");
  expect(
    await employee.action(api.voucherReconciliation.reconcileAtGate, { code: "PAID01" }),
  ).toBe("checked");
  await expect(
    employee.action(api.voucherReconciliation.reconcileAdmin, { codes: ["PAID01"] }),
  ).rejects.toThrow(/403/);
  expect(paymentFetches).toHaveLength(1);

  await liftThrottle(t);
  const admin = await withAuth(t, "admin");
  expect(
    await admin.action(api.voucherReconciliation.reconcileAtGate, { code: "PAID01" }),
  ).toBe("checked");
});

test("the admin batch checks pending and paid vouchers, reports each, and is capped at 50", async () => {
  const t = await paidSetup({ status: "refunded", statusDetail: "refunded" });
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", pendingVoucher("PEND01"));
  });
  fake.payments.set("pay-pend", {
    id: "pay-pend",
    status: "approved",
    externalReference: "PEND01",
    amount: 70,
    refundedAmount: 0,
  });
  const admin = await withAuth(t, "admin");

  const outcome = await admin.action(api.voucherReconciliation.reconcileAdmin, {
    codes: ["PAID01", "PEND01", "PAID01", "UNKNOWN"],
  });

  expect(outcome.updated).toBe(2);
  expect(outcome.failed).toBe(0);
  expect(outcome.results).toEqual([
    { code: "PAID01", result: "updated" },
    { code: "PEND01", result: "updated" },
    { code: "UNKNOWN", result: "skipped" },
  ]);

  const tooMany = Array.from({ length: 51 }, (_, i) => `C${i}`);
  await expect(
    admin.action(api.voucherReconciliation.reconcileAdmin, { codes: tooMany }),
  ).rejects.toThrow(/Muitos vouchers/);
});

test("a lost chargeback found on view refunds the voucher", async () => {
  const t = await paidSetup({ status: "charged_back", statusDetail: "in_process" });
  fake.chargebacks.set("pay-paid", [chargebackCase(false)]);

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("updated");

  const voucher = await reload(t);
  expect(voucher?.status).toBe("refunded");
  expect(voucher?.reversal?.reason).toBe("charged_back");
});

test("an open chargeback flags a dispute and keeps the voucher valid", async () => {
  const t = await paidSetup({ status: "charged_back", statusDetail: "in_process" });
  fake.chargebacks.set("pay-paid", [chargebackCase(null)]);

  const employee = await withAuth(t, "employee");
  await employee.action(api.voucherReconciliation.reconcileAtGate, { code: "PAID01" });

  const voucher = await reload(t);
  expect(voucher?.status).toBe("valid");
  expect(voucher?.paymentIssue?.kind).toBe("dispute");
});

test("a refunded voucher is checked again only when a chargeback caused it, so a won case can revert it", async () => {
  const reversal = (reason: string) => ({ reason, notedAt: Date.now() });
  const reverted = await paidSetup(
    { status: "charged_back", statusDetail: "reimbursed" },
    { status: "refunded", reversal: reversal("charged_back") },
  );
  fake.chargebacks.set("pay-paid", [chargebackCase(true)]);

  expect(
    await reverted.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("updated");
  const voucher = await reload(reverted);
  expect(voucher?.status).toBe("valid");
  expect(voucher?.reversal).toBeUndefined();

  const permanent = await paidSetup(
    { status: "approved", statusDetail: "accredited" },
    { status: "refunded", reversal: reversal("refunded") },
  );
  expect(
    await permanent.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("skipped");
  expect(paymentFetches).toEqual(["pay-paid"]);
  expect((await reload(permanent))?.status).toBe("refunded");
});

test("cancelled and deleted vouchers are never checked", async () => {
  const cancelled = await paidSetup({ status: "approved" }, { status: "cancelled" });
  expect(
    await cancelled.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("skipped");

  const deleted = await paidSetup();
  await deleted.run(async (ctx) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "PAID01"))
      .unique();
    if (!voucher) throw new Error("Test voucher missing");
    await ctx.db.patch(voucher._id, { deletedAt: Date.now() });
  });
  expect(
    await deleted.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("skipped");
  expect(paymentFetches).toHaveLength(0);
});

test("a provider failure on a paid voucher reports failed, leaves it unchanged and keeps reporting it while throttled", async () => {
  const t = await paidSetup({ status: "charged_back", statusDetail: "in_process" });
  fake.failNext("chargebacks");
  const employee = await withAuth(t, "employee");
  const check = () =>
    employee.action(api.voucherReconciliation.reconcileAtGate, { code: "PAID01" });

  expect(await check()).toBe("failed");
  const voucher = await reload(t);
  expect(voucher?.status).toBe("valid");
  expect(voucher?.reversal).toBeUndefined();
  expect(voucher?.paymentIssue).toBeUndefined();

  // Throttled even though the provider is now healthy: the failure is still
  // reported, so a re-opened Validar sheet keeps showing the notice.
  fake.failNext("chargebacks", false);
  expect(await check()).toBe("failed");

  // The next real check succeeds and clears it.
  await liftThrottle(t);
  expect(await check()).toBe("updated");
  expect(await check()).toBe("skipped");

  fake.payments.delete("pay-paid");
  await liftThrottle(t);
  expect(await check()).toBe("failed");
  expect((await reload(t))?.status).toBe("valid");
});

test("a payment that belongs to another voucher is never applied", async () => {
  const t = await paidSetup({ status: "refunded", statusDetail: "refunded" });
  const payment = fake.payments.get("pay-paid");
  if (!payment) throw new Error("Test payment missing");
  payment.externalReference = "OTHER01";

  expect(
    await t.action(api.voucherReconciliation.reconcileMine, {
      code: "PAID01",
      lookupToken: "lookup-PAID01",
    }),
  ).toBe("failed");
  expect((await reload(t))?.status).toBe("valid");
});
