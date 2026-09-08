import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let fake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  refundPayment: (...args: Parameters<typeof fake.api.refundPayment>) =>
    fake.api.refundPayment(...args),
  invalidatePreference: (
    ...args: Parameters<typeof fake.api.invalidatePreference>
  ) => fake.api.invalidatePreference(...args),
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof fake.api.findPaymentsByExternalReference>
  ) => fake.api.findPaymentsByExternalReference(...args),
  cancelPayment: (...args: Parameters<typeof fake.api.cancelPayment>) =>
    fake.api.cancelPayment(...args),
}));

describe("payment refunds", () => {

const visitDate = "2026-09-10";

function setupVoucherDefaults(overrides: Record<string, unknown> = {}) {
  return {
    code: "REF001",
    name: "Cliente Reembolso",
    phone: "11988887777",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 15000,
    status: "valid" as const,
    visitDate,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-ref01",
    paymentId: "pay-official",
    isTest: false,
    ...overrides,
  };
}

test("each Excess Payment gets exactly one Payment Refund, requested once even under repeated delivery", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-excess-1", {
    id: "pay-excess-1",
    status: "approved",
    externalReference: "REF001",
    amount: 150,
    refundedAmount: 0,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", setupVoucherDefaults());
    await ctx.db.insert("payments", {
      paymentId: "pay-official",
      voucherCode: "REF001",
      status: "approved",
      isOfficial: true,
      owesRefund: false,
      createdAt: Date.now(),
    });
  });

  // First delivery of excess payment
  const refundId1 = await t.mutation(internal.refunds.requestRefund, {
    paymentId: "pay-excess-1",
    voucherCode: "REF001",
    amountCents: 15000,
  });

  // Second delivery of same excess payment (duplicate webhook)
  const refundId2 = await t.mutation(internal.refunds.requestRefund, {
    paymentId: "pay-excess-1",
    voucherCode: "REF001",
    amountCents: 15000,
  });

  expect(refundId1).toEqual(refundId2);

  const allRefunds = await t.run(async (ctx) =>
    ctx.db
      .query("paymentRefunds")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-excess-1"))
      .collect(),
  );

  expect(allRefunds).toHaveLength(1);
  expect(allRefunds[0]?.amountCents).toBe(15000);
});

test("refund amount is always the full payment amount", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-excess-full", {
    id: "pay-excess-full",
    status: "approved",
    externalReference: "REF001",
    amount: 250,
    refundedAmount: 0,
  });

  const refundId = await t.mutation(internal.refunds.requestRefund, {
    paymentId: "pay-excess-full",
    voucherCode: "REF001",
    amountCents: 25000,
  });

  const record = await t.run(async (ctx) => ctx.db.get("paymentRefunds", refundId));
  expect(record?.amountCents).toBe(25000);
});

test("a transient failure reschedules with increasing spacing and eventually succeeds", async () => {
  vi.useFakeTimers();
  try {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    fake.payments.set("pay-transient", {
      id: "pay-transient",
      status: "approved",
      externalReference: "REF001",
      amount: 150,
      refundedAmount: 0,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupVoucherDefaults());
    });

    // Configure first attempt to fail transiently, second attempt to succeed
    fake.respondWith("refund", "transientFailure", "success");

    const refundId = await t.mutation(internal.refunds.requestRefund, {
      paymentId: "pay-transient",
      voucherCode: "REF001",
      amountCents: 15000,
    });

    // Scheduled initial attempt fails transiently, schedules retry with backoff, which finishes and succeeds
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const record = await t.run(async (ctx) => ctx.db.get("paymentRefunds", refundId));
    expect(record?.status).toBe("completed");
    expect(record?.completedAt).toBeDefined();
    expect(record?.attemptCount).toBe(1);
    expect(fake.refunds.size).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

test("a sweep recovers overdue refunds that lost their scheduled attempt", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-overdue", {
    id: "pay-overdue",
    status: "approved",
    externalReference: "REF001",
    amount: 150,
    refundedAmount: 0,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", setupVoucherDefaults());
    await ctx.db.insert("paymentRefunds", {
      paymentId: "pay-overdue",
      voucherCode: "REF001",
      amountCents: 15000,
      status: "needs_retry",
      attemptCount: 1,
      nextAttemptAt: Date.now() - 5000, // overdue!
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 5000,
    });
  });

  const sweptCount = await t.mutation(internal.refunds.sweepOverdueRefunds, {});
  expect(sweptCount).toBe(1);
});

test("a lost provider response is reconciled without issuing a second refund", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-lost-resp", {
    id: "pay-lost-resp",
    status: "approved",
    externalReference: "REF001",
    amount: 150,
    refundedAmount: 0,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", setupVoucherDefaults());
  });

  const refundId = await t.mutation(internal.refunds.requestRefund, {
    paymentId: "pay-lost-resp",
    voucherCode: "REF001",
    amountCents: 15000,
  });

  // First attempt: provider processes refund but response is lost
  fake.respondWith("refund", "lostResponse");
  await t.action(internal.refunds.attemptRefund, { refundId });

  // Verify that provider received the refund
  expect(fake.refunds.size).toBe(1);

  // Second attempt: reconciles against provider without double refunding
  await t.action(internal.refunds.attemptRefund, { refundId });

  // Number of refunds in provider remains exactly 1!
  expect(fake.refunds.size).toBe(1);

  const record = await t.run(async (ctx) => ctx.db.get("paymentRefunds", refundId));
  expect(record?.status).toBe("completed");
});

test("repeated failures raise an operational alert containing Voucher Code, payment and contact", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-repeated-fail", {
    id: "pay-repeated-fail",
    status: "approved",
    externalReference: "REF001",
    amount: 150,
    refundedAmount: 0,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", setupVoucherDefaults({
      code: "REF001",
      name: "João Silva",
      phone: "11988887777",
    }));
  });

  fake.respondWith("refund", "transientFailure", "transientFailure");

  const refundId = await t.mutation(internal.refunds.requestRefund, {
    paymentId: "pay-repeated-fail",
    voucherCode: "REF001",
    amountCents: 15000,
  });

  // Attempt 1: fails, no operational alert yet (only technical monitoring)
  await t.action(internal.refunds.attemptRefund, { refundId });

  let alerts = await t.run(async (ctx) =>
    ctx.db.query("operationalAlerts").collect(),
  );
  expect(alerts).toHaveLength(0);

  // Attempt 2: repeated failure -> raises operational alert
  await t.action(internal.refunds.attemptRefund, { refundId });

  alerts = await t.run(async (ctx) =>
    ctx.db.query("operationalAlerts").collect(),
  );
  expect(alerts).toHaveLength(1);
  expect(alerts[0]?.voucherCode).toBe("REF001");
  expect(alerts[0]?.paymentId).toBe("pay-repeated-fail");
  expect(alerts[0]?.customerContact).toEqual({
    name: "João Silva",
    phone: "11988887777",
  });
});

test("a refund for a charge received after redemption leaves the redemption intact", async () => {
  const t = createConvexTest();
  fake = createMercadoPagoFake();
  fake.payments.set("pay-after-redeem", {
    id: "pay-after-redeem",
    status: "approved",
    externalReference: "REDEEM01",
    amount: 100,
    refundedAmount: 0,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", setupVoucherDefaults({
      code: "REDEEM01",
      status: "redeemed",
      paymentId: "pay-official",
    }));
    await ctx.db.insert("payments", {
      paymentId: "pay-official",
      voucherCode: "REDEEM01",
      status: "approved",
      isOfficial: true,
      owesRefund: false,
      createdAt: Date.now(),
    });
  });

  // Late excess payment arrives for redeemed voucher via confirmPayment
  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "REDEEM01",
    paymentId: "pay-after-redeem",
    paymentStatus: "approved",
  });

  expect(result.becameValid).toBe(false);

  // Voucher status is still redeemed
  const voucher = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "REDEEM01"))
      .unique(),
  );
  expect(voucher?.status).toBe("redeemed");

  // Payment refund was created
  const refund = await t.run(async (ctx) =>
    ctx.db
      .query("paymentRefunds")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-after-redeem"))
      .unique(),
  );
  expect(refund).toBeDefined();
  expect(refund?.status).toBe("pending_attempt");
});
});
