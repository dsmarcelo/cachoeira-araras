import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Persists and tracks full Payment Refunds for Excess Payments.
 * Each Excess Payment receives exactly one Payment Refund, requested once
 * even under repeated webhook delivery.
 */
export const requestRefund = internalMutation({
  args: {
    paymentId: v.string(),
    voucherCode: v.string(),
    amountCents: v.number(),
  },
  returns: v.id("paymentRefunds"),
  handler: async (ctx, args): Promise<Id<"paymentRefunds">> => {
    const existing = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const refundId = await ctx.db.insert("paymentRefunds", {
      paymentId: args.paymentId,
      voucherCode: args.voucherCode,
      amountCents: args.amountCents,
      status: "pending_attempt",
      attemptCount: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.refunds.attemptRefund, {
      refundId,
    });

    return refundId;
  },
});

export const getRefund = internalQuery({
  args: { id: v.id("paymentRefunds") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get("paymentRefunds", id);
  },
});

export const prepareAttempt = internalMutation({
  args: { id: v.id("paymentRefunds") },
  returns: v.object({
    canAttempt: v.boolean(),
    operationId: v.optional(v.id("paymentOperations")),
  }),
  handler: async (ctx, { id }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (!refund || refund.status === "completed") {
      return { canAttempt: false };
    }

    let operationId = refund.operationId;
    operationId ??= await ctx.db.insert("paymentOperations", {
      request: { kind: "refund", paymentId: refund.paymentId },
    });

    await ctx.db.patch(id, {
      operationId,
      status: "processing",
      updatedAt: Date.now(),
    });

    return { canAttempt: true, operationId };
  },
});

export const markCompleted = internalMutation({
  args: { id: v.id("paymentRefunds") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (!refund) return null;

    const now = Date.now();
    await ctx.db.patch(id, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      lastError: undefined,
    });

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", refund.paymentId))
      .first();

    if (payment) {
      await ctx.db.patch(payment._id, {
        owesRefund: false,
        status: "refunded",
        updatedAt: now,
      });
    }

    return null;
  },
});

export const recordFailure = internalMutation({
  args: {
    id: v.id("paymentRefunds"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { id, error }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (!refund || refund.status === "completed") return null;

    const attemptCount = refund.attemptCount + 1;
    const delayMs = Math.min(1000 * Math.pow(2, attemptCount - 1), 60000);
    const nextAttemptAt = Date.now() + delayMs;

    await ctx.db.patch(id, {
      status: "needs_retry",
      attemptCount,
      nextAttemptAt,
      lastError: error.slice(0, 500),
      updatedAt: Date.now(),
    });

    // Technical monitoring handles first failure; repeated failures (>=2)
    // raise an operational alert for staff follow-up with customer contact.
    if (attemptCount >= 2) {
      const existingAlert = await ctx.db
        .query("operationalAlerts")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", refund.paymentId))
        .first();

      if (!existingAlert) {
        const voucher = await ctx.db
          .query("vouchers")
          .withIndex("by_code", (q) => q.eq("code", refund.voucherCode))
          .unique();

        await ctx.db.insert("operationalAlerts", {
          kind: "refund_failed",
          voucherCode: refund.voucherCode,
          paymentId: refund.paymentId,
          customerContact: {
            name: voucher?.name ?? "Desconhecido",
            phone: voucher?.phone ?? "",
          },
          lastError: error.slice(0, 500),
          attemptCount,
          createdAt: Date.now(),
        });
      }
    }

    await ctx.scheduler.runAfter(delayMs, internal.refunds.attemptRefund, {
      refundId: id,
    });

    return null;
  },
});

export const attemptRefund = internalAction({
  args: { refundId: v.id("paymentRefunds") },
  returns: v.null(),
  handler: async (ctx, { refundId }) => {
    const prep = await ctx.runMutation(internal.refunds.prepareAttempt, {
      id: refundId,
    });

    if (!prep.canAttempt || !prep.operationId) {
      return null;
    }

    try {
      await ctx.runAction(internal.paymentOperations.execute, {
        id: prep.operationId,
      });

      await ctx.runMutation(internal.refunds.markCompleted, {
        id: refundId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Provider request failed";

      await ctx.runMutation(internal.refunds.recordFailure, {
        id: refundId,
        error: message,
      });
    }

    return null;
  },
});

/**
 * Sweep for overdue refunds whose scheduled execution was missed or delayed.
 */
export const sweepOverdueRefunds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const needsRetry = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_status", (q) => q.eq("status", "needs_retry"))
      .collect();

    const pendingAttempt = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_status", (q) => q.eq("status", "pending_attempt"))
      .collect();

    const overdue = [...needsRetry, ...pendingAttempt].filter(
      (r) => (r.nextAttemptAt ?? 0) <= now,
    );

    for (const refund of overdue) {
      await ctx.scheduler.runAfter(0, internal.refunds.attemptRefund, {
        refundId: refund._id,
      });
    }

    return overdue.length;
  },
});

export const getRefundNoticesForVouchers = query({
  args: {
    voucherCodes: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      refundId: v.id("paymentRefunds"),
      paymentId: v.string(),
      voucherCode: v.string(),
      amountCents: v.number(),
      status: v.union(
        v.literal("pending_attempt"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("needs_retry"),
      ),
      isPostCancellation: v.boolean(),
      message: v.string(),
      isDismissible: v.boolean(),
      completedAt: v.optional(v.number()),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.voucherCodes.length === 0) {
      return [];
    }

    const results = [];
    for (const code of args.voucherCodes) {
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (!voucher || voucher.deletedAt !== undefined) {
        continue;
      }

      const refunds = await ctx.db
        .query("paymentRefunds")
        .withIndex("by_voucherCode", (q) => q.eq("voucherCode", code))
        .collect();

      for (const refund of refunds) {
        const isPostCancellation = voucher.status === "cancelled";
        let message: string;

        switch (refund.status) {
          case "completed":
            message = isPostCancellation
              ? "O pagamento feito após o cancelamento foi reembolsado."
              : "O pagamento duplicado foi reembolsado.";
            break;
          case "needs_retry":
            message =
              "O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.";
            break;
          case "pending_attempt":
          case "processing":
          default:
            message = isPostCancellation
              ? "Recebemos um pagamento após o cancelamento. O reembolso integral está sendo processado."
              : "Identificamos um pagamento duplicado. O reembolso integral está sendo processado.";
            break;
        }

        results.push({
          refundId: refund._id,
          paymentId: refund.paymentId,
          voucherCode: refund.voucherCode,
          amountCents: refund.amountCents,
          status: refund.status,
          isPostCancellation,
          message,
          isDismissible: refund.status === "completed",
          completedAt: refund.completedAt,
          updatedAt: refund.updatedAt,
        });
      }
    }

    return results;
  },
});
