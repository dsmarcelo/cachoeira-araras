/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest } from "./test.setup";
import { formatRefundMessage } from "../src/lib/voucher";

describe("refund notices (Issue 99)", () => {
  function setupVoucher(
    code: string,
    status: "cancelled" | "valid" | "redeemed" | "expired",
  ) {
    return {
      code,
      name: "Cliente Teste",
      phone: "11988884444",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 10000,
      status,
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: `pref-${code}`,
      managementToken: `token-${code}`,
      isTest: false,
    };
  }

  function voucherAccess(...codes: string[]) {
    return codes.map((code) => ({
      code,
      managementToken: `token-${code}`,
    }));
  }

  test("processing, confirmed and not-yet-confirmed refunds each show their specified wording", async () => {
    const t = createConvexTest();

    await t.run(async (ctx) => {
      // Cancelled voucher with processing refund
      await ctx.db.insert("vouchers", setupVoucher("CANC_PROC", "cancelled"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-canc-proc",
        voucherCode: "CANC_PROC",
        amountCents: 10000,
        status: "processing",
        attemptCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Cancelled voucher with completed refund
      await ctx.db.insert("vouchers", setupVoucher("CANC_CONF", "cancelled"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-canc-conf",
        voucherCode: "CANC_CONF",
        amountCents: 10000,
        status: "completed",
        attemptCount: 1,
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Cancelled voucher with failed attempt (needs_retry)
      await ctx.db.insert("vouchers", setupVoucher("CANC_FAIL", "cancelled"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-canc-fail",
        voucherCode: "CANC_FAIL",
        amountCents: 10000,
        status: "needs_retry",
        attemptCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const notices = await t.query(api.refunds.getRefundNoticesForVouchers, {
      vouchers: voucherAccess("CANC_PROC", "CANC_CONF", "CANC_FAIL"),
    });

    const procNotice = notices.find((n) => n.voucherCode === "CANC_PROC");
    expect(procNotice?.message).toBe(
      "Recebemos um pagamento após o cancelamento. O reembolso integral está sendo processado.",
    );
    expect(procNotice?.isDismissible).toBe(false);

    const confNotice = notices.find((n) => n.voucherCode === "CANC_CONF");
    expect(confNotice?.message).toBe(
      "O pagamento feito após o cancelamento foi reembolsado.",
    );
    expect(confNotice?.isDismissible).toBe(true);

    const failNotice = notices.find((n) => n.voucherCode === "CANC_FAIL");
    expect(failNotice?.message).toBe(
      "O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.",
    );
    expect(failNotice?.isDismissible).toBe(false);
  });

  test("a duplicate charge is described as a duplicate payment rather than a post-cancellation payment", async () => {
    const t = createConvexTest();

    await t.run(async (ctx) => {
      // Valid voucher with duplicate charge processing
      await ctx.db.insert("vouchers", setupVoucher("DUP_PROC", "valid"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-dup-proc",
        voucherCode: "DUP_PROC",
        amountCents: 10000,
        status: "pending_attempt",
        attemptCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Valid voucher with duplicate charge completed
      await ctx.db.insert("vouchers", setupVoucher("DUP_CONF", "valid"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-dup-conf",
        voucherCode: "DUP_CONF",
        amountCents: 10000,
        status: "completed",
        attemptCount: 1,
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const notices = await t.query(api.refunds.getRefundNoticesForVouchers, {
      vouchers: voucherAccess("DUP_PROC", "DUP_CONF"),
    });

    const dupProcNotice = notices.find((n) => n.voucherCode === "DUP_PROC");
    expect(dupProcNotice?.message).toBe(
      "Identificamos um pagamento duplicado. O reembolso integral está sendo processado.",
    );
    expect(dupProcNotice?.isPostCancellation).toBe(false);

    const dupConfNotice = notices.find((n) => n.voucherCode === "DUP_CONF");
    expect(dupConfNotice?.message).toBe(
      "O pagamento duplicado foi reembolsado.",
    );
    expect(dupConfNotice?.isPostCancellation).toBe(false);
  });

  test("voucher codes alone or a mismatched capability reveal no refund data", async () => {
    const t = createConvexTest();
    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupVoucher("PRIVATE", "cancelled"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "private-payment-id",
        voucherCode: "PRIVATE",
        amountCents: 10000,
        status: "processing",
        attemptCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const notices = await t.query(api.refunds.getRefundNoticesForVouchers, {
      vouchers: [{ code: "PRIVATE", managementToken: "wrong-token" }],
    });
    expect(notices).toEqual([]);
  });

  test("no completion message appears before the provider confirms the refund", async () => {
    const t = createConvexTest();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupVoucher("IN_PROG", "cancelled"));
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-in-prog",
        voucherCode: "IN_PROG",
        amountCents: 10000,
        status: "processing",
        attemptCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const notices = await t.query(api.refunds.getRefundNoticesForVouchers, {
      vouchers: voucherAccess("IN_PROG"),
    });

    const notice = notices[0];
    expect(notice?.message).not.toContain("foi reembolsado");
    expect(notice?.completedAt).toBeUndefined();
    expect(notice?.status).toBe("processing");
  });

  test("the success notice is dismissible and processing/failed refunds cannot be dismissed", async () => {
    const t = createConvexTest();

    await t.run(async (ctx) => {
      await ctx.db.insert("vouchers", setupVoucher("DISM_TEST", "cancelled"));
      // 1 completed (dismissible)
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-dism-1",
        voucherCode: "DISM_TEST",
        amountCents: 10000,
        status: "completed",
        attemptCount: 1,
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // 1 failed (not dismissible)
      await ctx.db.insert("paymentRefunds", {
        paymentId: "pay-dism-2",
        voucherCode: "DISM_TEST",
        amountCents: 10000,
        status: "needs_retry",
        attemptCount: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const notices = await t.query(api.refunds.getRefundNoticesForVouchers, {
      vouchers: voucherAccess("DISM_TEST"),
    });

    const completedNotice = notices.find((n) => n.status === "completed");
    expect(completedNotice?.isDismissible).toBe(true);

    const failedNotice = notices.find((n) => n.status === "needs_retry");
    expect(failedNotice?.isDismissible).toBe(false);
  });

  test("formatRefundMessage helper unit tests cover all cases", () => {
    expect(
      formatRefundMessage({ status: "processing", isPostCancellation: true }),
    ).toBe(
      "Recebemos um pagamento após o cancelamento. O reembolso integral está sendo processado.",
    );

    expect(
      formatRefundMessage({ status: "completed", isPostCancellation: true }),
    ).toBe("O pagamento feito após o cancelamento foi reembolsado.");

    expect(
      formatRefundMessage({ status: "processing", isPostCancellation: false }),
    ).toBe(
      "Identificamos um pagamento duplicado. O reembolso integral está sendo processado.",
    );

    expect(
      formatRefundMessage({ status: "completed", isPostCancellation: false }),
    ).toBe("O pagamento duplicado foi reembolsado.");

    expect(
      formatRefundMessage({ status: "needs_retry", isPostCancellation: true }),
    ).toBe(
      "O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.",
    );

    expect(
      formatRefundMessage({ status: "needs_retry", isPostCancellation: false }),
    ).toBe(
      "O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.",
    );
  });
});
