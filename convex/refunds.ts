import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getPayment } from "./lib/mercadopagoOperations";
import { MercadoPagoApiError } from "./lib/mercadopagoError";
import { explainRefundFailure, refundProviderDetail } from "./lib/refundFailure";
import type { Id } from "./_generated/dataModel";
import type { OperationResult } from "./lib/paymentOperation";
import { requireRole } from "./lib/auth";
import schema from "./schema";

const MAX_PUBLIC_REFUND_LOOKUPS = 50;
const REFUND_SWEEP_BATCH_SIZE = 100;
const MAX_REFUND_ATTEMPTS_PER_CYCLE = 5;
const PROCESSING_LEASE_MS = 5 * 60_000;

/** Admin-only view of the official payment's refund state. */
export const getAdminVoucherRefund = query({
  args: { paymentId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("paymentRefunds"),
      status: schema.tables.paymentRefunds.validator.fields.status,
      amountCents: v.number(),
      explanation: v.optional(v.string()),
      providerDetail: v.optional(v.string()),
      attemptCount: v.number(),
    }),
  ),
  handler: async (ctx, { paymentId }) => {
    await requireRole(ctx, "admin");
    const refund = await ctx.db
      .query("paymentRefunds")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .unique();
    if (!refund) return null;
    const operation = refund.operationId
      ? await ctx.db.get("paymentOperations", refund.operationId)
      : null;
    return {
      id: refund._id,
      status: refund.status,
      amountCents: refund.amountCents,
      attemptCount: refund.attemptCount,
      ...(refund.lastError
        ? {
            explanation: explainRefundFailure(
              operation?.lastHttpStatus,
              operation?.lastProviderCode,
              operation?.lastProviderMessage,
              refund.lastError,
            ),
          }
        : {}),
      providerDetail: refund.lastError
        ? refundProviderDetail(
            operation?.lastHttpStatus,
            operation?.lastProviderCode,
            operation?.lastProviderMessage,
          )
        : undefined,
    };
  },
});

export const getAdminRefundCandidate = internalQuery({
  args: { code: v.string() },
  returns: v.object({ paymentId: v.string() }),
  handler: async (ctx, { code }) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (
      !voucher ||
      voucher.deletedAt !== undefined ||
      voucher.isTest ||
      !voucher.paymentId ||
      ["pending", "cancelled", "refunded"].includes(voucher.status)
    ) {
      throw new Error("Este voucher não pode ser reembolsado.");
    }
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", voucher.paymentId!))
      .unique();
    if (
      payment &&
      (!payment.isOfficial ||
        payment.voucherCode !== code ||
        payment.status !== "approved")
    ) {
      throw new Error("Este pagamento não pode ser reembolsado.");
    }
    return { paymentId: voucher.paymentId };
  },
});

/** Requests a full refund for the voucher's official payment. */
export const requestAdminRefund = action({
  args: { code: v.string() },
  returns: v.id("paymentRefunds"),
  handler: async (ctx, { code }): Promise<Id<"paymentRefunds">> => {
    await requireRole(ctx, "admin");
    const candidate = await ctx.runQuery(
      internal.refunds.getAdminRefundCandidate,
      {
        code,
      },
    );
    let amountCents: number;
    try {
      const providerPayment = await getPayment(candidate.paymentId, {
        idempotencyKey: crypto.randomUUID(),
        recordedAt: Date.now(),
      });
      if (
        providerPayment.status !== "approved" ||
        providerPayment.externalReference !== code ||
        providerPayment.refundedAmount > 0
      ) {
        throw new Error("Payment is not eligible for a full refund");
      }
      amountCents = Math.round(providerPayment.amount * 100);
      if (
        amountCents <= 0 ||
        !Number.isSafeInteger(amountCents) ||
        Math.abs(providerPayment.amount * 100 - amountCents) > 0.001
      ) {
        throw new Error("Invalid payment amount");
      }
    } catch (error) {
      console.error(
        "Unable to validate Mercado Pago payment for admin refund",
        {
          code,
          paymentId: candidate.paymentId,
          error,
        },
      );
      throw new Error(
        error instanceof MercadoPagoApiError
          ? explainRefundFailure(
              error.status,
              error.providerCode,
              error.providerMessage,
            )
          : "Não foi possível confirmar o pagamento no Mercado Pago. Tente novamente mais tarde.",
      );
    }
    return await ctx.runMutation(internal.refunds.createAdminRefund, {
      code,
      paymentId: candidate.paymentId,
      amountCents,
    });
  },
});

export const createAdminRefund = internalMutation({
  args: {
    code: v.string(),
    paymentId: v.string(),
    amountCents: v.number(),
  },
  returns: v.id("paymentRefunds"),
  handler: async (
    ctx,
    { code, paymentId, amountCents },
  ): Promise<Id<"paymentRefunds">> => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (
      !voucher ||
      voucher.deletedAt !== undefined ||
      voucher.isTest ||
      voucher.paymentId !== paymentId ||
      ["pending", "cancelled", "refunded"].includes(voucher.status) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0
    ) {
      throw new Error("Este voucher não pode ser reembolsado.");
    }
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .unique();
    if (
      payment &&
      (!payment.isOfficial ||
        payment.voucherCode !== code ||
        payment.status !== "approved")
    ) {
      throw new Error("Este pagamento não pode ser reembolsado.");
    }
    return await ctx.runMutation(internal.refunds.requestRefund, {
      paymentId,
      voucherCode: code,
      amountCents,
    });
  },
});

/**
 * Tracks one full refund per Mercado Pago payment, whether requested for an
 * excess payment or by an admin for the official payment.
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
      retryCycleCount: 0,
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
  returns: v.union(schema.doc("paymentRefunds"), v.null()),
  handler: async (ctx, { id }) => {
    return await ctx.db.get("paymentRefunds", id);
  },
});

export const getRetryCandidate = internalQuery({
  args: { id: v.id("paymentRefunds") },
  returns: v.object({
    paymentId: v.string(),
    voucherCode: v.string(),
    amountCents: v.number(),
  }),
  handler: async (ctx, { id }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (refund?.status !== "needs_attention") {
      throw new Error("Este reembolso não está pausado para uma nova tentativa.");
    }
    return {
      paymentId: refund.paymentId,
      voucherCode: refund.voucherCode,
      amountCents: refund.amountCents,
    };
  },
});

/** Recheck provider state before a held refund can be tried again. */
export const retryAdminRefund = action({
  args: { id: v.id("paymentRefunds") },
  returns: v.union(v.literal("completed"), v.literal("queued")),
  handler: async (ctx, { id }): Promise<"completed" | "queued"> => {
    await requireRole(ctx, "admin");
    const refund = await ctx.runQuery(internal.refunds.getRetryCandidate, { id });
    let payment: Awaited<ReturnType<typeof getPayment>>;
    try {
      payment = await getPayment(refund.paymentId, {
        idempotencyKey: crypto.randomUUID(),
        recordedAt: Date.now(),
      });
    } catch (error) {
      console.error("Unable to verify payment before refund retry", {
        refundId: id,
        error,
      });
      throw new Error(
        error instanceof MercadoPagoApiError
          ? explainRefundFailure(
              error.status,
              error.providerCode,
              error.providerMessage,
            )
          : "Não foi possível consultar o pagamento no Mercado Pago. Tente novamente mais tarde.",
      );
    }
    const amountCents = Math.round(payment.amount * 100);
    if (
      payment.externalReference !== refund.voucherCode ||
      amountCents !== refund.amountCents ||
      !Number.isSafeInteger(amountCents)
    ) {
      throw new Error(
        "Os dados do pagamento não correspondem ao reembolso. Confira este caso no Mercado Pago antes de tentar novamente.",
      );
    }
    if (Math.round(payment.refundedAmount * 100) === refund.amountCents) {
      await ctx.runMutation(internal.refunds.markCompleted, { id });
      return "completed";
    }
    if (payment.refundedAmount > 0 || payment.status !== "approved") {
      throw new Error(
        "O pagamento não está aprovado sem estornos anteriores. Confira o estado e o valor devolvido no Mercado Pago antes de tentar novamente.",
      );
    }
    await ctx.runMutation(internal.refunds.resumeRefund, { id });
    return "queued";
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
    if (
      !refund ||
      refund.status === "completed" ||
      refund.status === "needs_attention"
    ) {
      return { canAttempt: false };
    }

    if (
      (refund.retryCycleCount ?? refund.attemptCount) >=
      MAX_REFUND_ATTEMPTS_PER_CYCLE
    ) {
      await ctx.db.patch(id, {
        status: "needs_attention",
        nextAttemptAt: undefined,
        updatedAt: Date.now(),
      });
      return { canAttempt: false };
    }

    if (
      refund.status === "processing" &&
      (refund.nextAttemptAt ?? 0) > Date.now()
    ) {
      return { canAttempt: false };
    }

    let operationId = refund.operationId;
    operationId ??= await ctx.db.insert("paymentOperations", {
      request: { kind: "refund", paymentId: refund.paymentId },
    });

    await ctx.db.patch(id, {
      operationId,
      status: "processing",
      nextAttemptAt: Date.now() + PROCESSING_LEASE_MS,
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

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", refund.voucherCode))
      .unique();
    if (voucher?.paymentId === refund.paymentId) {
      const reversal = voucher.reversal ?? { reason: "refunded", notedAt: now };
      if (voucher.status === "redeemed") {
        await ctx.db.patch(voucher._id, { reversal });
      } else if (voucher.status === "valid" || voucher.status === "expired") {
        await ctx.db.patch(voucher._id, { status: "refunded", reversal });
      }
    }

    const alert = await ctx.db
      .query("operationalAlerts")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", refund.paymentId))
      .first();
    if (alert) await ctx.db.delete(alert._id);

    return null;
  },
});

export const recordFailure = internalMutation({
  args: {
    id: v.id("paymentRefunds"),
    error: v.string(),
    httpStatus: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, error, httpStatus }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (
      !refund ||
      refund.status === "completed" ||
      refund.status === "needs_attention"
    )
      return null;

    const attemptCount = refund.attemptCount + 1;
    const retryCycleCount = (refund.retryCycleCount ?? refund.attemptCount) + 1;
    const needsAttention =
      (httpStatus !== undefined &&
        httpStatus >= 400 &&
        httpStatus < 500 &&
        httpStatus !== 429) ||
      retryCycleCount >= MAX_REFUND_ATTEMPTS_PER_CYCLE;
    const delayMs = Math.min(1000 * Math.pow(2, retryCycleCount - 1), 60000);
    const nextAttemptAt = Date.now() + delayMs;

    await ctx.db.patch(id, {
      status: needsAttention ? "needs_attention" : "needs_retry",
      attemptCount,
      retryCycleCount,
      nextAttemptAt: needsAttention ? undefined : nextAttemptAt,
      lastError: error.slice(0, 500),
      updatedAt: Date.now(),
    });

    // Technical monitoring handles first failure; repeated failures (>=2)
    // raise an operational alert for staff follow-up with customer contact.
    if (attemptCount >= 2 || needsAttention) {
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

    if (!needsAttention) {
      await ctx.scheduler.runAfter(delayMs, internal.refunds.attemptRefund, {
        refundId: id,
      });
    }

    return null;
  },
});

/** Resume a held refund after provider access and refund state are checked. */
export const resumeRefund = internalMutation({
  args: { id: v.id("paymentRefunds") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const refund = await ctx.db.get("paymentRefunds", id);
    if (refund?.status !== "needs_attention") {
      throw new Error("Reembolso não está aguardando intervenção.");
    }
    const now = Date.now();
    await ctx.db.patch(id, {
      status: "pending_attempt",
      retryCycleCount: 0,
      nextAttemptAt: now,
      lastError: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.refunds.attemptRefund, {
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
      const operation = await ctx.runQuery(internal.paymentOperations.get, {
        id: prep.operationId,
      });
      const message =
        operation.lastError ??
        (err instanceof Error ? err.message : "Provider request failed");

      await ctx.runMutation(internal.refunds.recordFailure, {
        id: refundId,
        error: message,
        httpStatus: operation.lastHttpStatus,
      });
      console.error("Mercado Pago refund attempt failed", {
        refundId,
        message,
        httpStatus: operation.lastHttpStatus,
        providerCode: operation.lastProviderCode,
        providerMessage: operation.lastProviderMessage,
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
        v.literal("needs_attention"),
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

      if (voucher?.code !== access.code || voucher.deletedAt !== undefined) {
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
              : refund.paymentId === voucher.paymentId
                ? "O reembolso do pagamento do voucher foi concluído."
              : "O pagamento duplicado foi reembolsado.";
            break;
          case "needs_retry":
            message =
              "O reembolso ainda não foi concluído. Continuaremos tentando automaticamente.";
            break;
          case "needs_attention":
            message =
              "O reembolso ainda não foi concluído. Nossa equipe foi avisada e está verificando o caso.";
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
      needsAttention: v.boolean(),
      refundId: v.optional(v.id("paymentRefunds")),
      explanation: v.string(),
      providerDetail: v.optional(v.string()),
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

    return await Promise.all(
      alerts.map(async (alert) => {
        const refund = await ctx.db
          .query("paymentRefunds")
          .withIndex("by_paymentId", (q) => q.eq("paymentId", alert.paymentId))
          .first();
        const operation = refund?.operationId
          ? await ctx.db.get("paymentOperations", refund.operationId)
          : null;
        return {
          id: alert._id,
          voucherCode: alert.voucherCode,
          customerName: alert.customerContact.name,
          customerPhone: alert.customerContact.phone,
          attemptCount: alert.attemptCount,
          needsAttention: refund?.status === "needs_attention",
          refundId: refund?._id,
          explanation: explainRefundFailure(
            operation?.lastHttpStatus,
            operation?.lastProviderCode,
            operation?.lastProviderMessage,
            refund?.lastError ?? alert.lastError,
          ),
          providerDetail: refundProviderDetail(
            operation?.lastHttpStatus,
            operation?.lastProviderCode,
            operation?.lastProviderMessage,
          ),
          createdAt: alert.createdAt,
        };
      }),
    );
  },
});
