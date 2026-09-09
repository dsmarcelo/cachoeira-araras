import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { OperationResult } from "./lib/paymentOperation";
import { requireRole } from "./lib/auth";

const MAX_PUBLIC_REFUND_LOOKUPS = 50;
const REFUND_SWEEP_BATCH_SIZE = 100;

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
    amountCents: v.optional(v.number()),
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

    return { canAttempt: true, operationId, amountCents: refund.amountCents };
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

      if (existingAlert) {
        await ctx.db.patch(existingAlert._id, {
          lastError: error.slice(0, 500),
          attemptCount,
        });
      } else {
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
      const result: OperationResult = await ctx.runAction(
        internal.paymentOperations.execute,
        {
          id: prep.operationId,
        },
      );

      if (
        !("status" in result) ||
        !("amount" in result) ||
        result.status !== "approved" ||
        Math.round(result.amount * 100) !== prep.amountCents
      ) {
        throw new Error("Integral refund was not confirmed by provider");
      }

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
      console.error("Mercado Pago refund attempt failed", {
        refundId,
        message,
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
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q.eq("status", "needs_retry").lte("nextAttemptAt", now),
      )
      .take(REFUND_SWEEP_BATCH_SIZE);

    const pendingAttempt = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q.eq("status", "pending_attempt").lte("nextAttemptAt", now),
      )
      .take(REFUND_SWEEP_BATCH_SIZE - needsRetry.length);

    const processing = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q.eq("status", "processing").lte("nextAttemptAt", now),
      )
      .take(
        REFUND_SWEEP_BATCH_SIZE - needsRetry.length - pendingAttempt.length,
      );

    const overdue = [...needsRetry, ...pendingAttempt, ...processing];

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
    vouchers: v.array(
      v.object({
        code: v.string(),
        managementToken: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      refundId: v.id("paymentRefunds"),
      voucherCode: v.string(),
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
    if (args.vouchers.length === 0) {
      return [];
    }
    if (args.vouchers.length > MAX_PUBLIC_REFUND_LOOKUPS) {
      throw new Error("Muitos vouchers consultados de uma só vez.");
    }

    const results = [];
    for (const access of args.vouchers) {
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_managementToken", (q) =>
          q.eq("managementToken", access.managementToken),
        )
        .unique();

      if (
        !voucher ||
        voucher.code !== access.code ||
        voucher.deletedAt !== undefined
      ) {
        continue;
      }

      const refunds = await ctx.db
        .query("paymentRefunds")
        .withIndex("by_voucherCode", (q) => q.eq("voucherCode", voucher.code))
        .take(100);

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
          voucherCode: refund.voucherCode,
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

/** Recent repeated refund failures that require staff follow-up. */
export const listOperationalAlerts = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("operationalAlerts"),
      voucherCode: v.string(),
      customerName: v.string(),
      customerPhone: v.string(),
      attemptCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const alerts = await ctx.db
      .query("operationalAlerts")
      .withIndex("by_kind", (q) => q.eq("kind", "refund_failed"))
      .order("desc")
      .take(100);

    return alerts.map((alert) => ({
      id: alert._id,
      voucherCode: alert.voucherCode,
      customerName: alert.customerContact.name,
      customerPhone: alert.customerContact.phone,
      attemptCount: alert.attemptCount,
      createdAt: alert.createdAt,
    }));
  },
});
