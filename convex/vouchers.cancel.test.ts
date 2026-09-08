/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";
import { getSaoPauloDateKey } from "../src/lib/utils/date";

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

describe("vouchers: cancel pending purchase", () => {
  const visitDate = getSaoPauloDateKey();

  function setupPendingVoucher(overrides: Record<string, unknown> = {}) {
    return {
      code: "CANC01",
      managementToken: crypto.randomUUID(),
      name: "Cliente Cancela",
      phone: "11988880000",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 10000,
      status: "pending" as const,
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-canc01",
      initPoint: "https://mercadopago.example/checkout/CANC01",
      isTest: false,
      ...overrides,
    };
  }

  test("the authorised browser can cancel a pending purchase; other browsers cannot", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const managementToken = crypto.randomUUID();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({ code: "AUTH01", managementToken }));
    });

    // Unauthorized attempt with wrong token
    const unauthorizedResult = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "AUTH01",
      managementToken: "wrong-token",
    });
    expect(unauthorizedResult.kind).toBe("unauthorized");

    // Authorized attempt with correct token
    const authorizedResult = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "AUTH01",
      managementToken,
    });
    expect(authorizedResult.kind).toBe("cancelled");

    const voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "AUTH01")).unique(),
    );
    expect(voucher?.status).toBe("cancelled");
  });

  test("cancelling checks Mercado Pago, invalidates preference, and cancels pending payments", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const managementToken = crypto.randomUUID();

    fake.payments.set("pay-canc-1", {
      id: "pay-canc-1",
      status: "pending",
      externalReference: "CANC02",
      amount: 100,
      refundedAmount: 0,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "CANC02",
        managementToken,
        preferenceId: "pref-canc02",
      }));
      await ctx.db.insert("payments", {
        paymentId: "pay-canc-1",
        voucherCode: "CANC02",
        status: "pending",
        isOfficial: false,
        owesRefund: false,
        createdAt: Date.now(),
      });
    });

    const result = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "CANC02",
      managementToken,
    });

    expect(result.kind).toBe("cancelled");

    // Preference was invalidated in provider
    expect(fake.invalidatedPreferences.has("pref-canc02")).toBe(true);

    // Pending payment was cancelled in provider
    expect(fake.payments.get("pay-canc-1")?.status).toBe("cancelled");

    // Local voucher and payment records are updated to cancelled
    const voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "CANC02")).unique(),
    );
    expect(voucher?.status).toBe("cancelled");

    const payment = await t.run(async (ctx) =>
      ctx.db.query("payments").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-canc-1")).unique(),
    );
    expect(payment?.status).toBe("cancelled");
  });

  test("an already-approved payment wins: becomes Official Payment, Voucher becomes Valid, and cancellation is refused", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const managementToken = crypto.randomUUID();

    // Mercado Pago already has an approved payment
    fake.payments.set("pay-appr-1", {
      id: "pay-appr-1",
      status: "approved",
      externalReference: "WIN01",
      amount: 100,
      refundedAmount: 0,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "WIN01",
        managementToken,
      }));
    });

    const result = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "WIN01",
      managementToken,
    });

    expect(result.kind).toBe("already_approved");
    if (result.kind === "already_approved") {
      expect(result.redirectUrl).toContain("WIN01");
      expect(result.message).toContain("já foi aprovado");
    }

    // Voucher is now valid with Official Payment
    const voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "WIN01")).unique(),
    );
    expect(voucher?.status).toBe("valid");
    expect(voucher?.paymentId).toBe("pay-appr-1");

    const payment = await t.run(async (ctx) =>
      ctx.db.query("payments").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-appr-1")).unique(),
    );
    expect(payment?.isOfficial).toBe(true);
    expect(payment?.status).toBe("approved");
  });

  test("a provider failure leaves the Voucher pending with an actionable message; retrying skips completed external steps", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const managementToken = crypto.randomUUID();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "FAIL01",
        managementToken,
        preferenceId: "pref-fail01",
      }));
    });

    // Make invalidation fail transiently on first attempt
    fake.respondWith("invalidatePreference", "transientFailure");

    const failResult = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "FAIL01",
      managementToken,
    });

    expect(failResult.kind).toBe("error");
    if (failResult.kind === "error") {
      expect(failResult.message).toContain("tente novamente");
    }

    // Voucher remains pending
    let voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "FAIL01")).unique(),
    );
    expect(voucher?.status).toBe("pending");

    // Retry succeeds idempotently
    const retryResult = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "FAIL01",
      managementToken,
    });

    expect(retryResult.kind).toBe("cancelled");

    voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "FAIL01")).unique(),
    );
    expect(voucher?.status).toBe("cancelled");
  });

  test("a Cancelled Voucher is never redeemable and never returns to Valid", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "DEAD01",
        status: "cancelled",
        visitDate,
      }));
    });

    const asEmployee = await withAuth(t, "employee");

    // Attempt to redeem cancelled voucher throws
    await expect(asEmployee.mutation(api.vouchers.redeemByCode, { code: "DEAD01" })).rejects.toThrow(
      "Este voucher não está disponível para uso.",
    );

    // Attempt to reactivate cancelled voucher throws
    await expect(asEmployee.mutation(api.vouchers.reactivate, { code: "DEAD01" })).rejects.toThrow(
      "Um voucher cancelado não pode ser reativado.",
    );
  });

  test("an approval arriving after cancellation is recorded as an Excess Payment and refunded in full", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "LATE01",
        status: "cancelled",
        priceCents: 10000,
      }));
    });

    const result = await t.mutation(internal.vouchers.confirmPayment, {
      code: "LATE01",
      paymentId: "pay-late-canc",
      paymentStatus: "approved",
    });

    expect(result.becameValid).toBe(false);

    // Voucher remains cancelled
    const voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "LATE01")).unique(),
    );
    expect(voucher?.status).toBe("cancelled");

    // Payment marked as Excess Payment
    const payment = await t.run(async (ctx) =>
      ctx.db.query("payments").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-late-canc")).unique(),
    );
    expect(payment?.isOfficial).toBe(false);
    expect(payment?.owesRefund).toBe(true);

    // PaymentRefund record created
    const refund = await t.run(async (ctx) =>
      ctx.db.query("paymentRefunds").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-late-canc")).unique(),
    );
    expect(refund?.amountCents).toBe(10000);
    expect(refund?.status).toBe("pending_attempt");
  });

  test("a late approval on an Expired Voucher gets the same protection", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "EXP01",
        status: "expired",
        expiresAt: Date.now() - 10000,
        priceCents: 8000,
      }));
    });

    const result = await t.mutation(internal.vouchers.confirmPayment, {
      code: "EXP01",
      paymentId: "pay-late-exp",
      paymentStatus: "approved",
    });

    expect(result.becameValid).toBe(false);

    // Voucher remains expired
    const voucher = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "EXP01")).unique(),
    );
    expect(voucher?.status).toBe("expired");

    // Payment marked as Excess Payment with full refund scheduled
    const payment = await t.run(async (ctx) =>
      ctx.db.query("payments").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-late-exp")).unique(),
    );
    expect(payment?.isOfficial).toBe(false);
    expect(payment?.owesRefund).toBe(true);

    const refund = await t.run(async (ctx) =>
      ctx.db.query("paymentRefunds").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-late-exp")).unique(),
    );
    expect(refund?.amountCents).toBe(8000);
  });

  test("Cancelled Vouchers never appear in operational lists or gate surfaces, and getVoucherForImage returns null", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const lookupToken = "e2b3c4d5-0000-4000-8000-000000000001";

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "HIDE01",
        status: "cancelled",
        visitDate,
        lookupToken,
      }));
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "SHOW01",
        status: "valid",
        visitDate,
      }));
    });

    const asEmployee = await withAuth(t, "employee");
    const gateList = await asEmployee.query(api.vouchers.listToday, {});
    const codes = gateList.map((v) => v.code);
    expect(codes).toContain("SHOW01");
    expect(codes).not.toContain("HIDE01");

    // Entry image rejects cancelled voucher
    const imageData = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "HIDE01")).unique(),
    );
    expect(imageData?.status).toBe("cancelled");

    const imageQuery = await t.query(internal.vouchers.getVoucherForImage, {
      code: "HIDE01",
      lookupToken,
    });
    expect(imageQuery).toBeNull();
  });

  test("cancelling frees the phone for a new purchase", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();
    const managementToken = crypto.randomUUID();
    const phone = "11988883333";

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "FREE01",
        phone,
        managementToken,
      }));
    });

    // Before cancelling: phone is blocked by 1 pending purchase
    let count = await t.query(internal.vouchers.countUnexpiredPendingByPhone, {
      phone,
      now: Date.now(),
    });
    expect(count).toBe(1);

    // Cancel the pending purchase
    const result = await t.action(api.vouchers.cancelPendingPurchase, {
      code: "FREE01",
      managementToken,
    });
    expect(result.kind).toBe("cancelled");

    // After cancelling: phone is free!
    count = await t.query(internal.vouchers.countUnexpiredPendingByPhone, {
      phone,
      now: Date.now(),
    });
    expect(count).toBe(0);
  });

  test("a concurrent webhook arriving mid-cancellation resolves consistently in both orderings", async () => {
    const t = createConvexTest();
    fake = createMercadoPagoFake();

    // Ordering 1: Webhook arrives before cancellation finalizes -> Payment wins, voucher becomes valid
    const token1 = crypto.randomUUID();
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "RACE01",
        managementToken: token1,
      }));
    });

    // Start cancellation (intent recorded)
    const prep = await t.mutation(internal.vouchers.prepareCancellation, {
      code: "RACE01",
      managementToken: token1,
    });
    expect(prep.ok).toBe(true);

    // Concurrent webhook arrives with approved payment
    await t.mutation(internal.vouchers.confirmPayment, {
      code: "RACE01",
      paymentId: "pay-race-1",
      paymentStatus: "approved",
    });

    // Finalize cancellation runs, but detects the approved payment won
    const finalize1 = await t.mutation(internal.vouchers.finalizeCancellation, {
      code: "RACE01",
    });
    expect(finalize1.outcome).toBe("already_approved");

    const voucher1 = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "RACE01")).unique(),
    );
    expect(voucher1?.status).toBe("valid");

    // Ordering 2: Cancellation finalizes first -> Voucher cancelled, late webhook treated as excess payment
    const token2 = crypto.randomUUID();
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupPendingVoucher({
        code: "RACE02",
        managementToken: token2,
      }));
    });

    const finalize2 = await t.mutation(internal.vouchers.finalizeCancellation, {
      code: "RACE02",
    });
    expect(finalize2.outcome).toBe("cancelled");

    // Concurrent/late webhook arrives
    const confirmResult = await t.mutation(internal.vouchers.confirmPayment, {
      code: "RACE02",
      paymentId: "pay-race-2",
      paymentStatus: "approved",
    });
    expect(confirmResult.becameValid).toBe(false);

    const voucher2 = await t.run(async (ctx) =>
      ctx.db.query("vouchers").withIndex("by_code", (q) => q.eq("code", "RACE02")).unique(),
    );
    expect(voucher2?.status).toBe("cancelled");

    const refund = await t.run(async (ctx) =>
      ctx.db.query("paymentRefunds").withIndex("by_paymentId", (q) => q.eq("paymentId", "pay-race-2")).unique(),
    );
    expect(refund).toBeDefined();
    expect(refund?.status).toBe("pending_attempt");
  });
});
