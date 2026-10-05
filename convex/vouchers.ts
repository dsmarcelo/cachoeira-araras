import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import { getVisitDateRejection } from "../src/lib/voucher/visit-date";
import {
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
} from "../src/lib/utils/date";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getRole, requireRole } from "./lib/auth";
import { authComponent } from "./auth";
import { createCheckoutPreference } from "./lib/mercadopago";
import {
  formatRetryAfter,
  MAX_PENDING_VOUCHERS_PER_PHONE,
  rateLimiter,
} from "./lib/rateLimiter";
import { mergeSettings, type SettingValueMap } from "./lib/settings";
import {
  classifyReferrer,
  formatVoucherCheckoutDescription,
  generateVoucherCode,
  splitCustomerName,
} from "./lib/voucherCode";
import { countsAsRealVoucher } from "./lib/financeSummary";
import { patchVoucher } from "./lib/voucherWrites";
import {
  decideReversalPatch,
  paidVoucherStatuses,
} from "./lib/paymentReversal";
import { normalizeSearchQuery, voucherSearchText } from "./lib/voucherSearch";
import { validateVoucherPurchase } from "./lib/voucherPurchase";
import {
  applyReschedule,
  isAdminReschedulable,
  rescheduledByValidator,
} from "./lib/voucherReschedule";
import type { PaymentSnapshot } from "./lib/paymentOperation";

export { countsAsRealVoucher };

export const voucherStatusValidator = v.union(
  v.literal("pending"),
  v.literal("valid"),
  v.literal("redeemed"),
  v.literal("expired"),
  v.literal("refunded"),
  v.literal("cancelled"),
);

/**
 * Whether a voucher counts as a live pending purchase that blocks a new checkout.
 * A pending voucher whose Visit Date has passed (expiresAt <= now) no longer blocks anything.
 * Cancelled, refunded, valid, redeemed, expired, and soft-deleted vouchers never block.
 */
export function isLivePendingVoucher(
  voucher: Pick<Doc<"vouchers">, "status" | "deletedAt" | "expiresAt">,
  now: number,
): boolean {
  return (
    voucher.status === "pending" &&
    voucher.deletedAt === undefined &&
    voucher.expiresAt > now
  );
}

const publicVoucherValidator = v.object({
  code: v.string(),
  createdAt: v.number(),
  status: voucherStatusValidator,
  visitDate: v.string(),
  expiresAt: v.number(),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  priceCents: v.number(),
});

function summarizeForPublic(voucher: Doc<"vouchers">) {
  return {
    code: voucher.code,
    createdAt: voucher._creationTime,
    status: voucher.status,
    visitDate: voucher.visitDate,
    expiresAt: voucher.expiresAt,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adultsPool,
    elderlyPool: voucher.elderlyPool,
    priceCents: voucher.priceCents,
  };
}

/**
 * Exchanges a Voucher Code for an opaque, voucher-scoped lookup capability.
 * Every anonymous attempt — including a miss — spends from one shared token
 * bucket, preventing callers from spreading a keyspace sweep across fake
 * sessions. The capability is authorization, not another voucher identifier:
 * Voucher Code remains the domain identity exposed in every returned record.
 */
export const authorizeLookup = mutation({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      kind: v.literal("authorized"),
      lookupToken: v.string(),
      voucher: publicVoucherValidator,
    }),
    v.object({ kind: v.literal("not_found") }),
    v.object({
      kind: v.literal("rate_limited"),
      retryAfterMs: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = await rateLimiter.limit(ctx, "voucherLookupGlobal");
    if (!limit.ok) {
      return {
        kind: "rate_limited" as const,
        retryAfterMs: limit.retryAfter ?? 0,
      };
    }

    // Bound attacker-controlled index keys while preserving legacy and future
    // Voucher Code formats. Invalid shapes are indistinguishable from misses.
    if (args.code.length === 0 || args.code.length > 64) {
      return { kind: "not_found" as const };
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      return { kind: "not_found" as const };
    }

    const lookupToken = voucher.lookupToken ?? crypto.randomUUID();
    if (voucher.lookupToken === undefined) {
      await patchVoucher(ctx, voucher, { lookupToken });
    }

    return {
      kind: "authorized" as const,
      lookupToken,
      voucher: summarizeForPublic(voucher),
    };
  },
});

/**
 * Reactively reads exactly the Voucher authorized by `lookupToken`. The query
 * accepts no Voucher Code, so it cannot be repurposed into an unthrottled code
 * sweep. Unknown capabilities and soft-deleted Vouchers both resolve to null.
 */
export const getAuthorized = query({
  args: { lookupToken: v.string() },
  returns: v.union(publicVoucherValidator, v.null()),
  handler: async (ctx, args) => {
    const voucher = await findVoucherByLookupToken(ctx, args.lookupToken);
    return voucher ? summarizeForPublic(voucher) : null;
  },
});

/**
 * Resolves a lookup capability to its live Voucher. Malformed tokens, unknown
 * tokens and soft-deleted Vouchers all resolve to null, so callers cannot
 * tell them apart.
 */
async function findVoucherByLookupToken(
  ctx: QueryCtx,
  lookupToken: string,
): Promise<Doc<"vouchers"> | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      lookupToken,
    )
  ) {
    return null;
  }

  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_lookupToken", (q) => q.eq("lookupToken", lookupToken))
    .unique();

  return voucher && voucher.deletedAt === undefined ? voucher : null;
}

/**
 * Lets a customer move their Pending or Valid voucher (whose Expiry has not
 * passed) to another day, authorized by the lookup capability alone. The new
 * day must satisfy the same Visit Date rule as a purchase, with the current
 * settings. There is no limit on how many times a voucher can be moved.
 */
export const rescheduleByCustomer = mutation({
  args: { lookupToken: v.string(), visitDate: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const voucher = await findVoucherByLookupToken(ctx, args.lookupToken);
    if (!voucher) {
      throw new ConvexError("Voucher não encontrado.");
    }
    if (
      (voucher.status !== "pending" && voucher.status !== "valid") ||
      voucher.expiresAt <= Date.now()
    ) {
      throw new ConvexError("Este voucher não pode mais ter a data alterada.");
    }

    const settings = mergeSettings(await ctx.db.query("settings").collect());
    const rejection = getVisitDateRejection(args.visitDate, {
      todayKey: getSaoPauloDateKey(),
      rules: {
        maxIntendedDays: settings["max.intended.days"],
        disabledDays: settings["disabled.days"],
      },
    });
    if (rejection !== null) {
      throw new ConvexError(rejection);
    }

    await applyReschedule(ctx, voucher, {
      visitDate: args.visitDate,
      by: { kind: "customer" },
    });
    return null;
  },
});

export const pendingConflictVoucherValidator = v.object({
  code: v.string(),
  visitDate: v.string(),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  priceCents: v.number(),
  status: voucherStatusValidator,
  actions: v.object({
    canResume: v.boolean(),
    canCancel: v.boolean(),
  }),
});

/**
 * Resolves pending purchase conflicts reactively when a phone number hits
 * the one-pending limit. If the caller provides valid management capability
 * tokens stored in their browser for that phone's purchases, returns an
 * authorized summary and allowed actions for every matching pending purchase.
 * If the caller lacks a valid capability, returns only a generic notice
 * directing them to the originating browser, without revealing any voucher
 * details or financial identifiers.
 */
export const getPendingConflict = query({
  args: {
    phone: v.string(),
    managementTokens: v.array(v.string()),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("authorized"),
      vouchers: v.array(pendingConflictVoucherValidator),
    }),
    v.object({
      kind: v.literal("generic"),
      message: v.string(),
    }),
    v.object({
      kind: v.literal("none"),
    }),
  ),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const vouchersForPhone = await ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    const livePending = vouchersForPhone.filter((voucher) =>
      isLivePendingVoucher(voucher, now),
    );

    const validTokens = new Set(
      args.managementTokens.filter((token) => token && token.length > 0),
    );

    const matchingPending = livePending.filter(
      (voucher) =>
        voucher.managementToken !== undefined &&
        validTokens.has(voucher.managementToken),
    );

    if (matchingPending.length > 0) {
      return {
        kind: "authorized" as const,
        vouchers: matchingPending.map((v) => ({
          code: v.code,
          visitDate: v.visitDate,
          adults: v.adults,
          elderly: v.elderly,
          adultsPool: v.adultsPool,
          elderlyPool: v.elderlyPool,
          priceCents: v.priceCents,
          status: v.status,
          actions: {
            canResume:
              v.status === "pending" &&
              v.expiresAt > now &&
              v.cancellationStartedAt === undefined,
            canCancel:
              v.status === "pending" && v.cancellationStartedAt === undefined,
          },
        })),
      };
    }

    if (livePending.length > 0) {
      return {
        kind: "generic" as const,
        message:
          "Você já tem uma compra pendente com este telefone. Acesse pelo navegador onde a compra foi iniciada para continuar ou cancelar.",
      };
    }

    const matchingUpdated = vouchersForPhone.filter(
      (voucher) =>
        voucher.deletedAt === undefined &&
        voucher.managementToken !== undefined &&
        validTokens.has(voucher.managementToken),
    );

    if (matchingUpdated.length > 0) {
      return {
        kind: "authorized" as const,
        vouchers: matchingUpdated.map((v) => ({
          code: v.code,
          visitDate: v.visitDate,
          adults: v.adults,
          elderly: v.elderly,
          adultsPool: v.adultsPool,
          elderlyPool: v.elderlyPool,
          priceCents: v.priceCents,
          status: v.status,
          actions: {
            canResume:
              v.status === "pending" &&
              v.expiresAt > now &&
              v.cancellationStartedAt === undefined,
            canCancel:
              v.status === "pending" && v.cancellationStartedAt === undefined,
          },
        })),
      };
    }

    return {
      kind: "none" as const,
    };
  },
});

/**
 * Server-verified resume of a pending purchase.
 * Requires the opaque management capability held by the originating browser.
 * Re-checks that the voucher is still pending, is not mid-cancellation,
 * and has no Official Payment before returning the payable checkout URL.
 * If already approved, returns redirect to the valid voucher.
 * If terminal (cancelled, expired, refunded, redeemed, or cancelling),
 * returns terminal status with an explanation and no payment action.
 */
export const resumePayment = mutation({
  args: {
    code: v.string(),
    managementToken: v.string(),
    savedInitPoint: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("resumed"),
      code: v.string(),
      checkoutUrl: v.string(),
    }),
    v.object({
      kind: v.literal("already_paid"),
      code: v.string(),
      redirectUrl: v.string(),
    }),
    v.object({
      kind: v.literal("terminal"),
      status: v.string(),
      message: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      throw new ConvexError("Voucher não encontrado.");
    }

    if (
      !voucher.managementToken ||
      voucher.managementToken !== args.managementToken
    ) {
      throw new ConvexError(
        "Não autorizado. A retomada do pagamento só é permitida no navegador original.",
      );
    }

    const now = Date.now();

    // 1. If payment is already approved, take caller to valid voucher
    if (voucher.status === "valid") {
      return {
        kind: "already_paid" as const,
        code: voucher.code,
        redirectUrl: `/pagamento?external_reference=${voucher.code}`,
      };
    }

    const officialPayment = await ctx.db
      .query("payments")
      .withIndex("by_voucherCode_and_isOfficial", (q) =>
        q.eq("voucherCode", voucher.code).eq("isOfficial", true),
      )
      .first();

    if (officialPayment?.status === "approved") {
      return {
        kind: "already_paid" as const,
        code: voucher.code,
        redirectUrl: `/pagamento?external_reference=${voucher.code}`,
      };
    }

    // 2. If mid-cancellation, no payment action
    if (voucher.cancellationStartedAt !== undefined) {
      return {
        kind: "terminal" as const,
        status: "cancelling",
        message:
          "Esta compra está em processo de cancelamento e não pode ser paga.",
      };
    }

    // 3. If terminal, no payment action and explain why
    if (voucher.status === "cancelled") {
      return {
        kind: "terminal" as const,
        status: "cancelled",
        message: "Esta compra foi cancelada e não pode mais ser paga.",
      };
    }

    if (voucher.status === "expired" || voucher.expiresAt <= now) {
      return {
        kind: "terminal" as const,
        status: "expired",
        message: "Esta compra expirou e não pode mais ser paga.",
      };
    }

    if (voucher.status === "refunded") {
      return {
        kind: "terminal" as const,
        status: "refunded",
        message: "Esta compra foi estornada e não pode mais ser paga.",
      };
    }

    if (voucher.status === "redeemed") {
      return {
        kind: "terminal" as const,
        status: "redeemed",
        message: "Este voucher já foi resgatado.",
      };
    }

    // 4. Still pending and payable
    if (voucher.status === "pending") {
      const checkoutUrl = voucher.initPoint ?? args.savedInitPoint;
      if (!checkoutUrl) {
        throw new ConvexError("Endereço de checkout não disponível.");
      }

      return {
        kind: "resumed" as const,
        code: voucher.code,
        checkoutUrl,
      };
    }

    return {
      kind: "terminal" as const,
      status: voucher.status,
      message: "Esta compra não está mais disponível para pagamento.",
    };
  },
});

export const prepareCancellation = internalMutation({
  args: {
    code: v.string(),
    managementToken: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      stage: v.literal("proceed"),
      searchOpId: v.id("paymentOperations"),
      invalidateOpId: v.optional(v.id("paymentOperations")),
      preferenceId: v.string(),
      voucherId: v.id("vouchers"),
    }),
    v.object({
      ok: v.literal(true),
      stage: v.literal("already_cancelled"),
    }),
    v.object({
      ok: v.literal(true),
      stage: v.literal("already_approved"),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("not_found"),
        v.literal("unauthorized"),
        v.literal("terminal"),
      ),
      status: v.optional(voucherStatusValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      return { ok: false as const, reason: "not_found" as const };
    }

    if (
      !voucher.managementToken ||
      voucher.managementToken !== args.managementToken
    ) {
      return { ok: false as const, reason: "unauthorized" as const };
    }

    if (voucher.status === "cancelled") {
      return { ok: true as const, stage: "already_cancelled" as const };
    }

    if (voucher.status === "valid" || voucher.status === "redeemed") {
      return { ok: true as const, stage: "already_approved" as const };
    }

    if (voucher.status !== "pending") {
      return {
        ok: false as const,
        reason: "terminal" as const,
        status: voucher.status,
      };
    }

    const officialPayment = await ctx.db
      .query("payments")
      .withIndex("by_voucherCode_and_isOfficial", (q) =>
        q.eq("voucherCode", voucher.code).eq("isOfficial", true),
      )
      .first();

    if (officialPayment?.status === "approved") {
      await patchVoucher(ctx, voucher, {
        status: "valid",
        paymentId: officialPayment.paymentId,
        cancellationStartedAt: undefined,
      });
      return { ok: true as const, stage: "already_approved" as const };
    }

    const now = Date.now();
    let searchOpId = voucher.cancellationSearchOpId;
    searchOpId ??= await ctx.db.insert("paymentOperations", {
      request: { kind: "search", externalReference: voucher.code },
    });

    let invalidateOpId = voucher.cancellationInvalidateOpId;
    if (invalidateOpId === undefined && voucher.preferenceId) {
      invalidateOpId = await ctx.db.insert("paymentOperations", {
        request: {
          kind: "invalidatePreference",
          preferenceId: voucher.preferenceId,
        },
      });
    }

    await patchVoucher(ctx, voucher, {
      cancellationStartedAt: voucher.cancellationStartedAt ?? now,
      cancellationSearchOpId: searchOpId,
      cancellationInvalidateOpId: invalidateOpId,
    });

    return {
      ok: true as const,
      stage: "proceed" as const,
      searchOpId,
      invalidateOpId,
      preferenceId: voucher.preferenceId,
      voucherId: voucher._id,
    };
  },
});

export const recordCancelPaymentOperation = internalMutation({
  args: { paymentId: v.string() },
  returns: v.id("paymentOperations"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentOperations", {
      request: { kind: "cancel", paymentId: args.paymentId },
    });
  },
});

export const finalizeCancellation = internalMutation({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({ outcome: v.literal("cancelled") }),
    v.object({ outcome: v.literal("already_approved") }),
  ),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher) return { outcome: "cancelled" as const };

    if (voucher.status === "valid" || voucher.status === "redeemed") {
      return { outcome: "already_approved" as const };
    }

    await patchVoucher(ctx, voucher, {
      status: "cancelled",
      cancellationStartedAt: undefined,
    });

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_voucherCode_and_isOfficial", (q) =>
        q.eq("voucherCode", voucher.code),
      )
      .collect();

    for (const payment of payments) {
      if (payment.status !== "approved" && payment.status !== "refunded") {
        await ctx.db.patch(payment._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });
      }
    }

    return { outcome: "cancelled" as const };
  },
});

export const clearCancellationIntent = internalMutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (voucher?.status === "pending") {
      await patchVoucher(ctx, voucher, {
        cancellationStartedAt: undefined,
      });
    }
    return null;
  },
});

export const cancelPendingPurchase = action({
  args: {
    code: v.string(),
    managementToken: v.string(),
  },
  returns: v.union(
    v.object({
      kind: v.literal("cancelled"),
      message: v.string(),
    }),
    v.object({
      kind: v.literal("already_approved"),
      redirectUrl: v.string(),
      message: v.string(),
    }),
    v.object({
      kind: v.literal("already_cancelled"),
      message: v.string(),
    }),
    v.object({
      kind: v.literal("unauthorized"),
      message: v.string(),
    }),
    v.object({
      kind: v.literal("error"),
      message: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const prep = await ctx.runMutation(internal.vouchers.prepareCancellation, {
      code: args.code,
      managementToken: args.managementToken,
    });

    if (!prep.ok) {
      if (prep.reason === "unauthorized") {
        return {
          kind: "unauthorized" as const,
          message:
            "Apenas o navegador que iniciou esta compra possui autorização para cancelá-la.",
        };
      }
      return {
        kind: "error" as const,
        message: "Não foi possível encontrar a compra para cancelamento.",
      };
    }

    if (prep.stage === "already_cancelled") {
      return {
        kind: "already_cancelled" as const,
        message: "Esta compra já foi cancelada.",
      };
    }

    if (prep.stage === "already_approved") {
      return {
        kind: "already_approved" as const,
        redirectUrl: `/pagamento?external_reference=${args.code}`,
        message:
          "O pagamento desta compra já foi aprovado. O cancelamento não foi realizado.",
      };
    }

    try {
      const searchResult = (await ctx.runAction(
        internal.paymentOperations.execute,
        { id: prep.searchOpId },
      )) as PaymentSnapshot[];

      const approvedPayment = searchResult.find((p) => p.status === "approved");

      if (approvedPayment) {
        await ctx.runMutation(internal.vouchers.confirmPayment, {
          code: args.code,
          paymentId: approvedPayment.id,
          paymentStatus: "approved",
          paymentTypeId: approvedPayment.paymentTypeId,
          paymentMethodId: approvedPayment.paymentMethodId,
        });
        await ctx.runMutation(internal.vouchers.clearCancellationIntent, {
          code: args.code,
        });
        return {
          kind: "already_approved" as const,
          redirectUrl: `/pagamento?external_reference=${args.code}`,
          message:
            "O pagamento desta compra já foi aprovado. O cancelamento não foi realizado.",
        };
      }

      if (prep.invalidateOpId) {
        await ctx.runAction(internal.paymentOperations.execute, {
          id: prep.invalidateOpId,
        });
      }

      const cancellableStatuses = ["pending", "in_process", "authorized"];
      const paymentsToCancel = searchResult.filter((p) =>
        cancellableStatuses.includes(p.status),
      );

      for (const p of paymentsToCancel) {
        const cancelOpId = await ctx.runMutation(
          internal.vouchers.recordCancelPaymentOperation,
          { paymentId: p.id },
        );
        const cancelledPayment = (await ctx.runAction(
          internal.paymentOperations.execute,
          {
            id: cancelOpId,
          },
        )) as PaymentSnapshot;

        if (cancelledPayment.status === "approved") {
          await ctx.runMutation(internal.vouchers.confirmPayment, {
            code: args.code,
            paymentId: cancelledPayment.id,
            paymentStatus: "approved",
            paymentAmountCents: Math.round(cancelledPayment.amount * 100),
            paymentTypeId: cancelledPayment.paymentTypeId,
            paymentMethodId: cancelledPayment.paymentMethodId,
          });
          await ctx.runMutation(internal.vouchers.clearCancellationIntent, {
            code: args.code,
          });
          return {
            kind: "already_approved" as const,
            redirectUrl: `/pagamento?external_reference=${args.code}`,
            message:
              "O pagamento desta compra já foi aprovado. O cancelamento não foi realizado.",
          };
        }
      }

      const finalized = await ctx.runMutation(
        internal.vouchers.finalizeCancellation,
        { code: args.code },
      );

      if (finalized.outcome === "already_approved") {
        return {
          kind: "already_approved" as const,
          redirectUrl: `/pagamento?external_reference=${args.code}`,
          message:
            "O pagamento desta compra já foi aprovado. O cancelamento não foi realizado.",
        };
      }

      return {
        kind: "cancelled" as const,
        message: "A compra foi cancelada com sucesso.",
      };
    } catch {
      await ctx.runMutation(internal.vouchers.clearCancellationIntent, {
        code: args.code,
      });
      return {
        kind: "error" as const,
        message:
          "Não foi possível concluir o cancelamento devido a uma instabilidade no Mercado Pago. Por favor, tente novamente.",
      };
    }
  },
});

/**
 * Staff-only reactive lookup for the gate. Authentication, rather than the
 * anonymous shared bucket, protects this direct Voucher Code query so gate
 * validation remains available even when public lookup traffic is blocked.
 */
export const getByCodeForStaff = query({
  args: { code: v.string() },
  returns: v.union(publicVoucherValidator, v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    if (args.code.length === 0 || args.code.length > 64) {
      return null;
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      return null;
    }

    return summarizeForPublic(voucher);
  },
});

const voucherImageValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  priceCents: v.number(),
  status: voucherStatusValidator,
  visitDate: v.string(),
  expiresAt: v.number(),
});

/** The fields the OG image renders, shared by the customer and staff paths. */
function summarizeForImage(voucher: Doc<"vouchers">) {
  return {
    code: voucher.code,
    name: voucher.name,
    phone: voucher.phone,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adultsPool,
    elderlyPool: voucher.elderlyPool,
    priceCents: voucher.priceCents,
    status: voucher.status,
    visitDate: voucher.visitDate,
    expiresAt: voucher.expiresAt,
  };
}

/**
 * The full record needed to render the "Meus Vouchers" OG image, including
 * name and phone. Internal only, deliberately not a public query — reached
 * exclusively via the `/services/voucher-image-data` HTTP action
 * (convex/http.ts) behind the same shared secret as the Mercado Pago webhook.
 * The caller must also present the opaque capability bound to this Voucher
 * Code, preventing the public OG adapter from becoming a code-enumeration
 * bypass that exposes buyer data.
 */
export const getVoucherForImage = internalQuery({
  args: { code: v.string(), lookupToken: v.string() },
  returns: v.union(voucherImageValidator, v.null()),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (
      !voucher ||
      voucher.deletedAt !== undefined ||
      voucher.lookupToken !== args.lookupToken ||
      voucher.status === "cancelled"
    ) {
      return null;
    }

    return summarizeForImage(voucher);
  },
});

/**
 * The same image record for a signed-in staff member (admin or employee),
 * authorized by the session instead of the customer's lookup token — the
 * token also authorizes rescheduling, which employees must not have. Reached
 * by `/api/og` when no token is present. Null for unknown, deleted, pending
 * or cancelled vouchers.
 */
export const getVoucherForStaffImage = query({
  args: { code: v.string() },
  returns: v.union(voucherImageValidator, v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    if (args.code.length === 0 || args.code.length > 64) {
      return null;
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (
      !voucher ||
      voucher.deletedAt !== undefined ||
      voucher.status === "pending" ||
      voucher.status === "cancelled"
    ) {
      return null;
    }

    return summarizeForImage(voucher);
  },
});

const maxVoucherCodeAttempts = 10;

export const referrerValidator = v.object({
  source: v.string(),
  url: v.string(),
});

function buildReferrer(
  referrerUrl: string | null | undefined,
): { source: string; url: string } | undefined {
  const normalized = referrerUrl?.trim();
  if (!normalized) {
    return undefined;
  }
  return { source: classifyReferrer(normalized), url: normalized };
}

/**
 * A voucher purchase: derive the price from the server environment (never
 * from client input), generate a short unique code, create the Mercado Pago
 * checkout preference, then hand off to `insertPendingVoucher` — which
 * re-checks code uniqueness and inserts in one transaction. A collision
 * there (two concurrent checkouts landing on the same code) retries this
 * whole loop with a fresh code and a fresh preference, rather than erroring
 * out on the loser.
 */
export const startCheckout = action({
  args: {
    name: v.string(),
    phone: v.string(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
    // The visitor's chosen visit date, as a client timestamp (ms). Converted
    // to a Sao Paulo calendar date server-side via getSaoPauloDateKey, the
    // one place that conversion happens.
    visitDateMs: v.number(),
    testMode: v.optional(v.boolean()),
    referrerUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    code: v.string(),
    preferenceId: v.string(),
    initPoint: v.string(),
    priceCents: v.number(),
    managementToken: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    code: string;
    preferenceId: string;
    initPoint: string;
    priceCents: number;
    managementToken: string;
  }> => {
    const role = await getRole(ctx);
    const canUseTestMode = role === "admin" || role === "employee";

    const settings: SettingValueMap = await ctx.runQuery(
      api.settings.getAll,
      {},
    );
    const visitDate = getSaoPauloDateKey(new Date(args.visitDateMs));

    const { priceCents } = validateVoucherPurchase(
      {
        adults: args.adults,
        elderly: args.elderly,
        adultsPool: args.adultsPool,
        elderlyPool: args.elderlyPool,
        visitDate,
        testMode: args.testMode,
      },
      { canUseTestMode, settings },
    );

    type InsertPendingVoucherResult =
      | { ok: true; managementToken: string }
      | { ok: false; reason: "code_collision" }
      | {
          ok: false;
          reason: "pending_conflict";
          operationId: Id<"paymentOperations">;
        };

    // Ceiling on unexpired Pending Vouchers per phone, checked before any
    // rate-limit token is spent: an abandoned pending checkout should send
    // the customer back to finish that one, not toward "wait and retry".
    const pendingCount: number = await ctx.runQuery(
      internal.vouchers.countUnexpiredPendingByPhone,
      { phone: args.phone, now: Date.now() },
    );
    if (pendingCount >= MAX_PENDING_VOUCHERS_PER_PHONE) {
      throw new ConvexError(
        "Você já tem uma compra pendente com este telefone. Finalize o pagamento pendente (verifique o código enviado anteriormente) antes de iniciar uma nova compra.",
      );
    }

    const phoneRateLimit = await rateLimiter.limit(ctx, "checkoutByPhone", {
      key: args.phone,
    });
    if (!phoneRateLimit.ok) {
      throw new ConvexError(
        `Muitas tentativas de compra com este telefone. Aguarde ${formatRetryAfter(phoneRateLimit.retryAfter ?? 0)} e tente novamente.`,
      );
    }

    const globalRateLimit = await rateLimiter.limit(ctx, "checkoutGlobal");
    if (!globalRateLimit.ok) {
      throw new ConvexError(
        `O sistema está processando muitas compras no momento. Aguarde ${formatRetryAfter(globalRateLimit.retryAfter ?? 0)} e tente novamente.`,
      );
    }

    const { firstName, surname } = splitCustomerName(args.name);
    const referrer = buildReferrer(args.referrerUrl);
    const isTest = args.testMode === true;
    const expiresAt = endOfSaoPauloDayMs(visitDate);

    for (let attempt = 1; attempt <= maxVoucherCodeAttempts; attempt += 1) {
      const code = generateVoucherCode();
      const managementToken = crypto.randomUUID();

      const preference = await createCheckoutPreference({
        code,
        description: formatVoucherCheckoutDescription({
          adults: args.adults,
          elderly: args.elderly,
          adultsPool: args.adultsPool,
          elderlyPool: args.elderlyPool,
          phone: args.phone,
          code,
        }),
        priceCents,
        name: firstName,
        surname,
        phone: args.phone,
      });

      const result: InsertPendingVoucherResult = await ctx.runMutation(
        internal.vouchers.insertPendingVoucher,
        {
          code,
          managementToken,
          name: args.name,
          phone: args.phone,
          adults: args.adults,
          elderly: args.elderly,
          adultsPool: args.adultsPool,
          elderlyPool: args.elderlyPool,
          priceCents,
          visitDate,
          expiresAt,
          preferenceId: preference.id,
          initPoint: preference.initPoint,
          referrer,
          isTest,
        },
      );

      if (result.ok) {
        return {
          code,
          preferenceId: preference.id,
          initPoint: preference.initPoint,
          priceCents,
          managementToken: result.managementToken,
        };
      }

      if (result.reason === "pending_conflict") {
        try {
          await ctx.runAction(internal.paymentOperations.execute, {
            id: result.operationId,
          });
        } catch {
          // Failure is observable on paymentOperations (reconcile records lastError);
          // background retry is already scheduled.
        }

        throw new ConvexError(
          "Você já tem uma compra pendente com este telefone. Finalize o pagamento pendente (verifique o código enviado anteriormente) antes de iniciar uma nova compra.",
        );
      }

      // Code collision: retry with a fresh code and a fresh preference
      // rather than surfacing an error to the loser.
    }

    throw new ConvexError(
      "Não foi possível gerar um código de voucher disponível.",
    );
  },
});

/**
 * Counts unexpired Pending Vouchers held by `phone`, so checkout can refuse
 * to pile up abandoned preferences (audit issue 10: 56 abandoned Pending
 * Vouchers accumulated for lack of this ceiling). Scoped by the `by_phone`
 * index.
 */
export const countUnexpiredPendingByPhone = internalQuery({
  args: { phone: v.string(), now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const vouchers = await ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    return vouchers.filter((voucher) => isLivePendingVoucher(voucher, args.now))
      .length;
  },
});

/**
 * Resolves voucher records for a set of Mercado Pago payments by code
 * (externalReference) or paymentId. Used by the Mercado Pago admin action to
 * enrich payments with voucher data from Convex without Prisma.
 */
export const findForPaymentEnrichment = internalQuery({
  args: {
    codes: v.array(v.string()),
    paymentIds: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      code: v.string(),
      name: v.string(),
      phone: v.string(),
      paymentId: v.union(v.string(), v.null()),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const vouchers: Array<{
      code: string;
      name: string;
      phone: string;
      paymentId: string | null;
      status: string;
    }> = [];

    const seenCodes = new Set<string>();

    for (const code of args.codes) {
      if (!code) continue;
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (voucher && voucher.deletedAt === undefined) {
        seenCodes.add(voucher.code);
        vouchers.push({
          code: voucher.code,
          name: voucher.name,
          phone: voucher.phone,
          paymentId: voucher.paymentId ?? null,
          status: voucher.status,
        });
      }
    }

    for (const paymentId of args.paymentIds) {
      if (!paymentId) continue;
      let voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
        .unique();

      if (!voucher) {
        const payment = await ctx.db
          .query("payments")
          .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
          .unique();
        if (payment) {
          voucher = await ctx.db
            .query("vouchers")
            .withIndex("by_code", (q) => q.eq("code", payment.voucherCode))
            .unique();
        }
      }

      if (
        voucher &&
        voucher.deletedAt === undefined &&
        !seenCodes.has(voucher.code)
      ) {
        seenCodes.add(voucher.code);
        vouchers.push({
          code: voucher.code,
          name: voucher.name,
          phone: voucher.phone,
          paymentId: voucher.paymentId ?? null,
          status: voucher.status,
        });
      }
    }

    return vouchers;
  },
});

/**
 * Re-checks code uniqueness and phone pending-purchase limit, then inserts
 * the Pending voucher in one transaction, closing the time-of-check/time-of-use
 * race. If the phone already holds a live pending voucher, creates an invalidation
 * intent for the losing preference, schedules retry, and returns pending_conflict.
 * If code collides, returns code_collision so checkout can retry with a fresh code.
 */
export const insertPendingVoucher = internalMutation({
  args: {
    code: v.string(),
    managementToken: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
    priceCents: v.number(),
    visitDate: v.string(),
    expiresAt: v.number(),
    preferenceId: v.string(),
    initPoint: v.optional(v.string()),
    referrer: v.optional(referrerValidator),
    isTest: v.boolean(),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), managementToken: v.string() }),
    v.object({
      ok: v.literal(false),
      reason: v.literal("code_collision"),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.literal("pending_conflict"),
      operationId: v.id("paymentOperations"),
    }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      return { ok: false as const, reason: "code_collision" as const };
    }

    const now = args.now ?? Date.now();

    const vouchersForPhone = await ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    const hasLivePending = vouchersForPhone.some((voucher) =>
      isLivePendingVoucher(voucher, now),
    );

    if (hasLivePending) {
      const operationId = await ctx.db.insert("paymentOperations", {
        request: {
          kind: "invalidatePreference",
          preferenceId: args.preferenceId,
        },
      });

      await ctx.scheduler.runAfter(
        0,
        internal.paymentOperations.executeWithRetry,
        { id: operationId },
      );

      return {
        ok: false as const,
        reason: "pending_conflict" as const,
        operationId,
      };
    }

    const managementToken = args.managementToken ?? crypto.randomUUID();

    await ctx.db.insert("vouchers", {
      code: args.code,
      managementToken,
      name: args.name,
      phone: args.phone,
      adults: args.adults,
      elderly: args.elderly,
      adultsPool: args.adultsPool,
      elderlyPool: args.elderlyPool,
      priceCents: args.priceCents,
      status: "pending",
      visitDate: args.visitDate,
      expiresAt: args.expiresAt,
      preferenceId: args.preferenceId,
      initPoint: args.initPoint,
      referrer: args.referrer,
      isTest: args.isTest,
      purchasedAt: Date.now(),
      searchText: voucherSearchText(args),
      isActive: !args.isTest,
    });

    return { ok: true as const, managementToken };
  },
});

/**
 * Mercado Pago statuses that mean the payment behind a Voucher was reversed
 * after the fact: a refund, a chargeback, or a cancellation. Distinct from
 * "not approved yet" (`in_process`, `rejected`, ...), which the fallthrough
 * below already handles without touching a `valid`/`redeemed` Voucher.
 * Used for payments outside the Voucher policy (Excess Payments); the
 * Official Payment goes through `decideReversalPatch`.
 */
const negativeTerminalPaymentStatuses = new Set([
  "refunded",
  "charged_back",
  "cancelled",
]);

/**
 * Confirms a Mercado Pago payment against the voucher it paid for. Internal
 * only — the sole caller is the `/webhooks/mercadopago/confirmPayment` HTTP
 * action (convex/http.ts), reached from the Mercado Pago webhook route (a
 * thin Next.js adapter that has already verified MP's HMAC signature) over a
 * shared-secret door, never a Convex identity. There is deliberately no
 * public `mutation` wrapping this: a signed-in admin session has no path to
 * it at all.
 *
 * Each observed payment is recorded individually in the `payments` table,
 * unique by its Mercado Pago payment identifier.
 *
 * The first approved payment for a Voucher becomes its Official Payment and is
 * the only payment that can make the Voucher Valid. Two concurrent approvals
 * cannot both validate the same Voucher.
 *
 * Every further approval is an Excess Payment, recorded with `isOfficial: false`
 * and `owesRefund: true`. It leaves a Valid, Redeemed, Expired, Cancelled, or
 * Refunded Voucher untouched.
 *
 * Redelivering the same payment identifier with the same status, status
 * detail and chargeback outcome is idempotent and reports no new conversion.
 * For that check, an omitted `statusDetail` or `chargebackOutcome` means "not
 * reported" and matches whatever is stored.
 *
 * The Official Payment of a paid Voucher (`valid`, `redeemed`, `expired` or
 * `refunded`) applies the reversal policy in `convex/lib/paymentReversal.ts`
 * (ADR 0007): refunds and cancellations reverse the Voucher permanently, a
 * lost chargeback reverses it revocably, a won one undoes that reversal, and
 * a dispute or partial refund only flags it (`paymentIssue`). A non-approved
 * update never clears the Official Payment's `isOfficial`. An Excess Payment
 * reversal only updates that payment record and leaves the Voucher untouched.
 *
 * `statusDetail` is Mercado Pago's `status_detail`; `refundedCents` the
 * integer cents already returned (the caller converts from reais);
 * `chargebackOutcome` is the chargeback case result for a `charged_back`
 * payment, and `undefined` when none was found.
 *
 * `paymentTypeId`/`paymentMethodId` are Mercado Pago's `payment_type_id`
 * ("credit_card", "debit_card", "bank_transfer", …) and `payment_method_id`
 * ("pix", "visa", "master", …); they are stored on the Voucher with the
 * Official Payment so the Financeiro report can split revenue by method.
 */
export const confirmPayment = internalMutation({
  args: {
    code: v.string(),
    paymentId: v.string(),
    paymentStatus: v.union(v.string(), v.null()),
    paymentAmountCents: v.optional(v.number()),
    paymentTypeId: v.optional(v.string()),
    paymentMethodId: v.optional(v.string()),
    statusDetail: v.optional(v.string()),
    refundedCents: v.optional(v.number()),
    chargebackOutcome: v.optional(
      v.union(v.literal("open"), v.literal("won"), v.literal("lost")),
    ),
  },
  returns: v.union(
    v.object({
      outcome: v.union(
        v.literal("redeemed"),
        v.literal("already_processed"),
        v.literal("updated"),
        v.literal("reversed"),
      ),
      becameValid: v.boolean(),
      isTest: v.boolean(),
    }),
    v.object({ outcome: v.literal("not_found") }),
  ),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher) {
      return { outcome: "not_found" as const };
    }

    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
      .unique();

    const now = Date.now();
    const reply = (
      outcome: "redeemed" | "already_processed" | "updated" | "reversed",
    ) => ({ outcome, becameValid: false as const, isTest: voucher.isTest });

    // An unknown chargeback outcome keeps the one already recorded for the
    // same status, so a failed case lookup never turns an open dispute into a
    // reversal.
    const chargebackOutcome =
      args.chargebackOutcome ??
      (existingPayment?.status === args.paymentStatus
        ? existingPayment.chargebackOutcome
        : undefined);

    const isPartialRefund =
      args.paymentStatus === "approved" &&
      args.statusDetail === "partially_refunded";

    // Idempotent redelivery check: the payment was already recorded with the
    // same status, status detail and chargeback outcome (and, for a partial
    // refund, the same refunded amount). Omitted optional fields mean "not
    // reported" and match whatever is stored.
    if (
      existingPayment !== null &&
      existingPayment.status === args.paymentStatus &&
      (args.statusDetail === undefined ||
        existingPayment.statusDetail === args.statusDetail) &&
      chargebackOutcome === existingPayment.chargebackOutcome &&
      (!isPartialRefund ||
        args.refundedCents === undefined ||
        !existingPayment.isOfficial ||
        voucher.paymentIssue?.refundedCents === args.refundedCents)
    ) {
      return reply(
        voucher.status === "redeemed" ? "redeemed" : "already_processed",
      );
    }

    // Writes what Mercado Pago reported to this payment's own row.
    const recordPayment = async (flags: {
      isOfficial: boolean;
      owesRefund: boolean;
    }) => {
      const observed = {
        status: args.paymentStatus,
        statusDetail: args.statusDetail,
        chargebackOutcome,
        ...flags,
      };
      if (existingPayment) {
        await ctx.db.patch("payments", existingPayment._id, {
          ...observed,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("payments", {
          paymentId: args.paymentId,
          voucherCode: voucher.code,
          ...observed,
          createdAt: now,
        });
      }
    };

    // A voucher paid before `payments` rows existed has none; its own
    // `paymentId` marks its Official Payment.
    const isOfficialPayment = existingPayment
      ? existingPayment.isOfficial
      : voucher.paymentId === args.paymentId &&
        paidVoucherStatuses.has(voucher.status);

    // The Official Payment of a paid Voucher: its provider state decides the
    // Voucher's status, reversal and payment-issue flag.
    if (isOfficialPayment && paidVoucherStatuses.has(voucher.status)) {
      await recordPayment({ isOfficial: true, owesRefund: false });
      const patch = decideReversalPatch(
        voucher,
        {
          status: args.paymentStatus,
          statusDetail: args.statusDetail,
          refundedCents: args.refundedCents,
          chargebackOutcome,
        },
        now,
      );
      if (patch !== null) {
        await patchVoucher(ctx, voucher, patch);
      }
      if (voucher.status === "redeemed") return reply("redeemed");
      if (patch?.status === "refunded") return reply("reversed");
      return reply(patch === null ? "already_processed" : "updated");
    }

    // Handle legacy or test vouchers with paymentId on voucher but no row in
    // payments (a cancelled voucher; paid ones are handled above).
    if (
      existingPayment === null &&
      voucher.paymentId === args.paymentId &&
      args.paymentStatus === "approved" &&
      voucher.status !== "pending"
    ) {
      await recordPayment({ isOfficial: true, owesRefund: false });
      return reply("already_processed");
    }

    // A reversal arriving for an Excess Payment, or for a Voucher that never
    // became paid: only the payment row changes.
    if (
      args.paymentStatus !== null &&
      negativeTerminalPaymentStatuses.has(args.paymentStatus)
    ) {
      await recordPayment({
        isOfficial: existingPayment?.isOfficial ?? false,
        owesRefund: false,
      });
      return reply("updated");
    }

    if (args.paymentStatus === "approved") {
      const existingOfficialPayment = await ctx.db
        .query("payments")
        .withIndex("by_voucherCode_and_isOfficial", (q) =>
          q.eq("voucherCode", voucher.code).eq("isOfficial", true),
        )
        .first();

      const canBeOfficial =
        voucher.status === "pending" &&
        voucher.deletedAt === undefined &&
        voucher.expiresAt > now &&
        (!existingOfficialPayment ||
          existingOfficialPayment.paymentId === args.paymentId);

      if (canBeOfficial) {
        await patchVoucher(ctx, voucher, {
          status: "valid",
          paymentId: args.paymentId,
          paymentTypeId: args.paymentTypeId,
          paymentMethodId: args.paymentMethodId,
        });
        await recordPayment({ isOfficial: true, owesRefund: false });

        return {
          outcome: "updated" as const,
          becameValid: true,
          isTest: voucher.isTest,
        };
      }

      // Excess Payment: voucher is Valid, Redeemed, Expired, Cancelled or Refunded
      await recordPayment({ isOfficial: false, owesRefund: true });

      const existingRefund = await ctx.db
        .query("paymentRefunds")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
        .first();

      if (!existingRefund) {
        const refundId = await ctx.db.insert("paymentRefunds", {
          paymentId: args.paymentId,
          voucherCode: voucher.code,
          amountCents: args.paymentAmountCents ?? voucher.priceCents,
          status: "pending_attempt",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.refunds.attemptRefund, {
          refundId,
        });
      }

      return reply("updated");
    }

    // Non-approved payment (e.g. in_process, pending, rejected, in_mediation)
    // that is not the Official Payment of a paid Voucher. An Official Payment
    // row keeps its flag.
    await recordPayment({
      isOfficial: existingPayment?.isOfficial ?? false,
      owesRefund: false,
    });

    if (voucher.status === "pending" && voucher.paymentId === undefined) {
      await patchVoucher(ctx, voucher, { paymentId: args.paymentId });
    }

    return reply("updated");
  },
});

const gateVoucherValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  status: voucherStatusValidator,
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  visitDate: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
});

function summarizeForGate(voucher: Doc<"vouchers">) {
  return {
    code: voucher.code,
    name: voucher.name,
    phone: voucher.phone,
    status: voucher.status,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adultsPool,
    elderlyPool: voucher.elderlyPool,
    visitDate: voucher.visitDate,
    expiresAt: voucher.expiresAt,
    createdAt: voucher.purchasedAt ?? voucher._creationTime,
  };
}

/**
 * Today's real vouchers (excludes Test Vouchers and soft-deleted rows), keyed
 * on `visitDate` in the Sao Paulo calendar so the operational day rolls over
 * at Sao Paulo midnight, not at 21:00 on a UTC server. Shared by both
 * `listToday` and `listTodayAdmin` so the day/index/filter logic lives in one
 * place.
 */
async function todaysRealVouchers(ctx: { db: QueryCtx["db"] }) {
  const today = getSaoPauloDateKey();
  const vouchers = await ctx.db
    .query("vouchers")
    .withIndex("by_visitDate", (q) => q.eq("visitDate", today))
    .collect();

  return vouchers
    .filter((v) => countsAsRealVoucher(v) && v.status !== "cancelled")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The vouchers gate staff expect to see today. Staff-only (admin or
 * employee): a public caller gets a 401 rather than any data. Test Vouchers
 * are excluded via `countsAsRealVoucher` — they stay redeemable by code
 * (`redeemByCode` below), just absent from this operational view. An
 * ordinary reactive query, so a payment confirmed by the webhook while staff
 * are looking at the screen appears without a refresh.
 *
 * Deliberately PII-minimal: this is the query an employee session can reach.
 * Payment identifiers (`paymentId`, `preferenceId`) and referrer live only in
 * `listTodayAdmin`, which is admin-gated.
 */
export const listToday = query({
  args: {},
  returns: v.array(gateVoucherValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "employee");

    const vouchers = await todaysRealVouchers(ctx);
    return vouchers.map(summarizeForGate);
  },
});

const gateVoucherAdminValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  status: voucherStatusValidator,
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  visitDate: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
  paymentId: v.optional(v.string()),
  preferenceId: v.string(),
  referrer: v.optional(referrerValidator),
  // The staff-visible warning set when a payment is reversed after the
  // Voucher was already redeemed (see `confirmPayment`). Undefined for
  // every Voucher this never happened to.
  reversal: v.optional(v.object({ reason: v.string(), notedAt: v.number() })),
  // The most recent Reschedule, shown in the admin drawer.
  rescheduledAt: v.optional(v.number()),
  rescheduledBy: v.optional(rescheduledByValidator),
});

function summarizeForGateAdmin(voucher: Doc<"vouchers">) {
  return {
    ...summarizeForGate(voucher),
    paymentId: voucher.paymentId,
    preferenceId: voucher.preferenceId,
    referrer: voucher.referrer,
    reversal: voucher.reversal,
    rescheduledAt: voucher.rescheduledAt,
    rescheduledBy: voucher.rescheduledBy,
  };
}

/**
 * The admin variant of `listToday`: same today/Sao Paulo/Test-Voucher rules,
 * plus the payment identifiers and referrer the admin gate card's "Detalhes
 * do pagamento" section needs. Admin-only — an employee identity is rejected
 * here even though it can read `listToday`, so an employee session has no
 * path to a payment id or preference id.
 */
export const listTodayAdmin = query({
  args: {},
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const vouchers = await todaysRealVouchers(ctx);
    return vouchers.map(summarizeForGateAdmin);
  },
});

/** Reads one non-deleted voucher by code; null for unknown or malformed codes. */
async function findLiveVoucherByCode(ctx: { db: QueryCtx["db"] }, code: string) {
  if (code.length === 0 || code.length > 64) {
    return null;
  }

  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  return voucher && voucher.deletedAt === undefined ? voucher : null;
}

/**
 * One voucher in the employee gate shape, for the gate drawer and the
 * "Validar voucher" info button. Unlike `listToday` it is not limited to
 * today or real vouchers: a staff member who typed a code (Test Vouchers
 * included) sees that voucher. Null for unknown or deleted codes.
 */
export const getGateByCode = query({
  args: { code: v.string() },
  returns: v.union(gateVoucherValidator, v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    const voucher = await findLiveVoucherByCode(ctx, args.code);
    return voucher ? summarizeForGate(voucher) : null;
  },
});

/** Admin variant of `getGateByCode`, with payment identifiers and referrer. */
export const getGateAdminByCode = query({
  args: { code: v.string() },
  returns: v.union(gateVoucherAdminValidator, v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await findLiveVoucherByCode(ctx, args.code);
    return voucher ? summarizeForGateAdmin(voucher) : null;
  },
});

/**
 * Redeems a voucher by code at the gate. Staff-only. Refuses (rather than
 * silently no-opping) a voucher that is already `redeemed`, so a second
 * attempt cannot admit the same party twice; refuses anything not currently
 * `valid`; and refuses a voucher whose `visitDate` isn't today in Sao Paulo,
 * so nobody is admitted on the wrong day. Deliberately does not filter Test
 * Vouchers: they must stay redeemable by code so the full purchase-to-entry
 * path can be verified.
 */
export const redeemByCode = mutation({
  args: { code: v.string() },
  returns: v.object({ code: v.string(), status: v.literal("redeemed") }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      throw new ConvexError("Voucher não encontrado.");
    }

    if (voucher.status === "redeemed") {
      throw new ConvexError("Este voucher já foi utilizado.");
    }

    if (voucher.status !== "valid") {
      throw new ConvexError("Este voucher não está disponível para uso.");
    }

    const today = getSaoPauloDateKey();
    if (voucher.visitDate !== today) {
      throw new ConvexError("Este voucher não é válido para o dia de hoje.");
    }

    await patchVoucher(ctx, voucher, { status: "redeemed" });

    return { code: voucher.code, status: "redeemed" as const };
  },
});

/**
 * Reactivates a voucher when a customer has a legitimate reason. Staff-only.
 * Moves only `expiresAt`, extending it to the end of today in Sao Paulo, and
 * sets `status` back to `valid`; `visitDate` — the day the customer
 * originally chose — is never touched, which is the whole point: the old
 * schema conflated the two fields, so reactivating used to silently rewrite
 * the customer's visit date and corrupt reporting.
 */
export const reactivate = mutation({
  args: { code: v.string() },
  returns: v.object({
    code: v.string(),
    status: v.literal("valid"),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      throw new ConvexError("Voucher não encontrado.");
    }

    if (voucher.status === "cancelled") {
      throw new ConvexError("Um voucher cancelado não pode ser reativado.");
    }

    const expiresAt = endOfSaoPauloDayMs(getSaoPauloDateKey());
    await patchVoucher(ctx, voucher, { status: "valid", expiresAt });

    return { code: voucher.code, status: "valid" as const, expiresAt };
  },
});

const MAX_ADMIN_SEARCH_LENGTH = 64;

/**
 * Trims and normalizes the admin search box. Returns undefined for an empty
 * search (meaning "no search") and refuses text longer than the limit.
 */
function parseAdminSearch(search: string | undefined): string | undefined {
  const trimmed = search?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_ADMIN_SEARCH_LENGTH) {
    throw new ConvexError(
      `A busca pode ter no máximo ${MAX_ADMIN_SEARCH_LENGTH} caracteres.`,
    );
  }
  return normalizeSearchQuery(trimmed) || undefined;
}

/**
 * Every real voucher (excludes Test Vouchers and soft-deleted rows), one page
 * at a time, for the admin table. Admin-only: an employee identity is
 * rejected, same as `listTodayAdmin`.
 *
 * Without `search`, rows come newest sale first straight from an index, with
 * `status` and the `purchasedFrom`/`purchasedTo` range applied in the index.
 * With `search` (word or prefix match on code, name and phone, accents and
 * case ignored) the search index is used instead and rows come by relevance;
 * the date range then runs as a post-filter. `expiresAfter`/`expiresBefore`
 * are always post-filters, so a page may hold fewer rows than requested.
 *
 * Vouchers not yet backfilled with `purchasedAt` (see
 * `migrations.backfillVoucherPurchasedAtAndSearchText`) only drop out of the
 * view when a purchase date range is set, and of search results always.
 */
export const listAdmin = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(voucherStatusValidator),
    purchasedFrom: v.optional(v.number()),
    purchasedTo: v.optional(v.number()),
    expiresAfter: v.optional(v.number()),
    expiresBefore: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  returns: paginationResultValidator(gateVoucherAdminValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const search = parseAdminSearch(args.search);
    const { status, purchasedFrom, purchasedTo } = args;

    const base = search
      ? ctx.db.query("vouchers").withSearchIndex("search_text", (q) => {
          const filtered = q.search("searchText", search).eq("isActive", true);
          return status ? filtered.eq("status", status) : filtered;
        })
      : status
        ? ctx.db
            .query("vouchers")
            .withIndex(
              "by_isTest_and_deletedAt_and_status_and_purchasedAt",
              (q) => {
                const scoped = q
                  .eq("isTest", false)
                  .eq("deletedAt", undefined)
                  .eq("status", status);
                if (purchasedFrom === undefined && purchasedTo === undefined) {
                  return scoped;
                }
                return purchasedTo === undefined
                  ? scoped.gte("purchasedAt", purchasedFrom ?? 0)
                  : scoped
                      .gte("purchasedAt", purchasedFrom ?? 0)
                      .lte("purchasedAt", purchasedTo);
              },
            )
            .order("desc")
        : ctx.db
            .query("vouchers")
            .withIndex("by_isTest_and_deletedAt_and_purchasedAt", (q) => {
              const scoped = q.eq("isTest", false).eq("deletedAt", undefined);
              if (purchasedFrom === undefined && purchasedTo === undefined) {
                return scoped;
              }
              return purchasedTo === undefined
                ? scoped.gte("purchasedAt", purchasedFrom ?? 0)
                : scoped
                    .gte("purchasedAt", purchasedFrom ?? 0)
                    .lte("purchasedAt", purchasedTo);
            })
            .order("desc");

    const result = await base
      .filter((q) =>
        q.and(
          // Date bounds already enforced by the index when not searching.
          search && args.purchasedFrom !== undefined
            ? q.gte(q.field("purchasedAt"), args.purchasedFrom)
            : true,
          search && args.purchasedTo !== undefined
            ? q.lte(q.field("purchasedAt"), args.purchasedTo)
            : true,
          args.expiresAfter !== undefined
            ? q.gte(q.field("expiresAt"), args.expiresAfter)
            : true,
          args.expiresBefore !== undefined
            ? q.lte(q.field("expiresAt"), args.expiresBefore)
            : true,
        ),
      )
      .paginate(args.paginationOpts);

    return { ...result, page: result.page.map(summarizeForGateAdmin) };
  },
});

/**
 * Codes of live Pending vouchers that have not yet expired, capped at 200.
 * Feeds the admin table's payment reconciliation, which must look at every
 * pending voucher regardless of which page of the table is loaded.
 */
export const listPendingCodes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const pending = await ctx.db
      .query("vouchers")
      .withIndex("by_status_and_deletedAt_and_expiresAt", (q) =>
        q.eq("status", "pending").eq("deletedAt", undefined),
      )
      .take(200);

    return pending.filter((voucher) => !voucher.isTest).map((v) => v.code);
  },
});

/**
 * Soft-deleted vouchers, one page at a time, for the admin's separate
 * audit/restore view — the mirror image of `listAdmin`: everything it hides
 * for being deleted, this shows, newest deletion first (relevance order when
 * searching). Test Vouchers are included since a soft-deleted Test Voucher is
 * still something an admin may want to audit or restore. Admin-only.
 */
export const listDeleted = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  returns: paginationResultValidator(gateVoucherAdminValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const search = parseAdminSearch(args.search);

    const result = search
      ? await ctx.db
          .query("vouchers")
          .withSearchIndex("search_text", (q) =>
            q.search("searchText", search).eq("isActive", false),
          )
          // `isActive: false` also covers live Test Vouchers.
          .filter((q) => q.neq(q.field("deletedAt"), undefined))
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("vouchers")
          .withIndex("by_deletedAt", (q) => q.gte("deletedAt", 0))
          .order("desc")
          .paginate(args.paginationOpts);

    return { ...result, page: result.page.map(summarizeForGateAdmin) };
  },
});

/** Looks up a voucher by code or throws, shared by the admin correction mutations below. */
async function requireVoucherByCode(
  ctx: MutationCtx,
  code: string,
): Promise<Doc<"vouchers">> {
  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  if (!voucher) {
    throw new ConvexError("Voucher não encontrado.");
  }
  return voucher;
}

/**
 * Corrects a voucher's status when something needs fixing. Admin-only,
 * unlike `redeemByCode`/`reactivate` which employees can also reach — this
 * is a direct override rather than an operational action, so it stays
 * restricted to the role that can also restore.
 */
export const updateStatus = mutation({
  args: { code: v.string(), status: voucherStatusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    if (voucher.status === "cancelled" && args.status !== "cancelled") {
      throw new ConvexError(
        "Um voucher cancelado é terminal e não pode ter o status alterado.",
      );
    }
    await patchVoucher(ctx, voucher, { status: args.status });
    return null;
  },
});

/**
 * Moves a voucher to another Visit Date as an admin. Allowed on Pending, Valid
 * and Expired vouchers (Expired returns to Valid; the nightly job only deletes
 * overdue Pending vouchers, so Expired always means previously paid). Any day
 * from today on is accepted: the booking window and closed days are for
 * customers. The admin's username is recorded as the author.
 */
export const rescheduleByAdmin = mutation({
  args: { code: v.string(), visitDate: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user || typeof user.username !== "string") {
      throw new ConvexError("Não foi possível identificar o administrador.");
    }

    const voucher = await requireVoucherByCode(ctx, args.code);
    if (voucher.deletedAt !== undefined) {
      throw new ConvexError("Voucher excluído não pode ser reagendado.");
    }
    if (!isAdminReschedulable(voucher.status)) {
      throw new ConvexError(
        "Só é possível reagendar vouchers pendentes, válidos ou expirados.",
      );
    }

    const rejection = getVisitDateRejection(args.visitDate, {
      todayKey: getSaoPauloDateKey(),
    });
    if (rejection !== null) {
      throw new ConvexError(rejection);
    }

    await applyReschedule(ctx, voucher, {
      visitDate: args.visitDate,
      by: { kind: "admin", username: user.username },
      revive: true,
    });
    return null;
  },
});

/** Restores a soft-deleted voucher back into `listAdmin`. Admin-only. */
export const restore = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    // Convex `patch` removes a field entirely when set to `undefined`.
    await patchVoucher(ctx, voucher, {
      deletedAt: undefined,
      isActive: !voucher.isTest,
    });
    return null;
  },
});
