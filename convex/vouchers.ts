import { ConvexError, v } from "convex/values";

import {
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
  startOfSaoPauloDayMs,
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
import { createCheckoutPreference } from "./lib/mercadopago";
import {
  formatRetryAfter,
  MAX_PENDING_VOUCHERS_PER_PHONE,
  rateLimiter,
} from "./lib/rateLimiter";
import type { SettingValueMap } from "./lib/settings";
import {
  classifyReferrer,
  formatVoucherCheckoutDescription,
  generateVoucherCode,
  splitCustomerName,
} from "./lib/voucherCode";
import { validateVoucherPurchase } from "./lib/voucherPurchase";
import type { PaymentSnapshot } from "./lib/paymentOperation";

/**
 * Whether a voucher counts as a real, live voucher for operational and
 * reporting purposes: not soft-deleted, and not a Test Voucher. Every gate,
 * admin, and summary query must use this instead of re-typing the two
 * conditions, so a new query can't accidentally forget one.
 */
export function countsAsRealVoucher(
  voucher: Pick<Doc<"vouchers">, "deletedAt" | "isTest">,
): boolean {
  return voucher.deletedAt === undefined && !voucher.isTest;
}

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
      await ctx.db.patch("vouchers", voucher._id, { lookupToken });
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
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        args.lookupToken,
      )
    ) {
      return null;
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_lookupToken", (q) =>
        q.eq("lookupToken", args.lookupToken),
      )
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      return null;
    }

    return summarizeForPublic(voucher);
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
    const now = Date.now();
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
      await ctx.db.patch(voucher._id, {
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

    await ctx.db.patch(voucher._id, {
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

    await ctx.db.patch(voucher._id, {
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
      await ctx.db.patch(voucher._id, {
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
    const prep = await ctx.runMutation(
      internal.vouchers.prepareCancellation,
      { code: args.code, managementToken: args.managementToken },
    );

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

      const approvedPayment = searchResult.find(
        (p) => p.status === "approved",
      );

      if (approvedPayment) {
        await ctx.runMutation(internal.vouchers.confirmPayment, {
          code: args.code,
          paymentId: approvedPayment.id,
          paymentStatus: "approved",
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
        await ctx.runAction(internal.paymentOperations.execute, {
          id: cancelOpId,
        });
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
  returns: v.union(
    v.object({
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
    }),
    v.null(),
  ),
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
 * A voucher purchase: derive the price from current Site Settings (never
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

    return vouchers.filter((voucher) =>
      isLivePendingVoucher(voucher, args.now),
    ).length;
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
    });

    return { ok: true as const, managementToken };
  },
});

/**
 * Mercado Pago statuses that mean the payment behind a Voucher was reversed
 * after the fact: a refund, a chargeback, or a cancellation. Distinct from
 * "not approved yet" (`in_process`, `rejected`, ...), which the fallthrough
 * below already handles without touching a `valid`/`redeemed` Voucher.
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
 * Redelivering the same payment identifier with the same status is idempotent
 * and reports no new conversion.
 *
 * A negative-terminal notification (`refunded`, `charged_back`, `cancelled`)
 * for the Official Payment moves a `valid` Voucher to `refunded`, or records
 * a `reversal` warning on an already `redeemed` Voucher. A negative-terminal
 * notification for an Excess Payment updates that payment record and leaves the
 * Voucher untouched.
 */
export const confirmPayment = internalMutation({
  args: {
    code: v.string(),
    paymentId: v.string(),
    paymentStatus: v.union(v.string(), v.null()),
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

    // Idempotent redelivery check: if this payment was already recorded with the same status
    if (
      existingPayment !== null &&
      existingPayment.status === args.paymentStatus
    ) {
      if (voucher.status === "redeemed") {
        return {
          outcome: "redeemed" as const,
          becameValid: false,
          isTest: voucher.isTest,
        };
      }
      return {
        outcome: "already_processed" as const,
        becameValid: false,
        isTest: voucher.isTest,
      };
    }

    // Handle legacy or test vouchers with paymentId on voucher but no row in payments
    if (
      existingPayment === null &&
      voucher.paymentId === args.paymentId &&
      args.paymentStatus === "approved" &&
      voucher.status !== "pending"
    ) {
      await ctx.db.insert("payments", {
        paymentId: args.paymentId,
        voucherCode: voucher.code,
        status: args.paymentStatus,
        isOfficial: true,
        owesRefund: false,
        createdAt: Date.now(),
      });
      if (voucher.status === "redeemed") {
        return {
          outcome: "redeemed" as const,
          becameValid: false,
          isTest: voucher.isTest,
        };
      }
      return {
        outcome: "already_processed" as const,
        becameValid: false,
        isTest: voucher.isTest,
      };
    }

    const reversalReason: string | null =
      args.paymentStatus !== null &&
      negativeTerminalPaymentStatuses.has(args.paymentStatus)
        ? args.paymentStatus
        : null;

    const isOfficialPayment =
      Boolean(existingPayment?.isOfficial) ||
      voucher.paymentId === args.paymentId;

    if (reversalReason !== null) {
      if (isOfficialPayment) {
        if (voucher.status === "redeemed") {
          if (voucher.reversal === undefined) {
            const reversal = { reason: reversalReason, notedAt: Date.now() };
            await ctx.db.patch(voucher._id, { reversal });
          }
          if (existingPayment) {
            await ctx.db.patch(existingPayment._id, {
              status: args.paymentStatus,
              updatedAt: Date.now(),
            });
          } else {
            await ctx.db.insert("payments", {
              paymentId: args.paymentId,
              voucherCode: voucher.code,
              status: args.paymentStatus,
              isOfficial: true,
              owesRefund: false,
              createdAt: Date.now(),
            });
          }
          return {
            outcome: "redeemed" as const,
            becameValid: false,
            isTest: voucher.isTest,
          };
        }

        if (voucher.status === "refunded") {
          if (existingPayment) {
            await ctx.db.patch(existingPayment._id, {
              status: args.paymentStatus,
              updatedAt: Date.now(),
            });
          } else {
            await ctx.db.insert("payments", {
              paymentId: args.paymentId,
              voucherCode: voucher.code,
              status: args.paymentStatus,
              isOfficial: true,
              owesRefund: false,
              createdAt: Date.now(),
            });
          }
          return {
            outcome: "already_processed" as const,
            becameValid: false,
            isTest: voucher.isTest,
          };
        }

        if (voucher.status === "valid") {
          const reversal = { reason: reversalReason, notedAt: Date.now() };
          await ctx.db.patch(voucher._id, { status: "refunded", reversal });
          if (existingPayment) {
            await ctx.db.patch(existingPayment._id, {
              status: args.paymentStatus,
              updatedAt: Date.now(),
            });
          } else {
            await ctx.db.insert("payments", {
              paymentId: args.paymentId,
              voucherCode: voucher.code,
              status: args.paymentStatus,
              isOfficial: true,
              owesRefund: false,
              createdAt: Date.now(),
            });
          }
          return {
            outcome: "reversed" as const,
            becameValid: false,
            isTest: voucher.isTest,
          };
        }

        if (existingPayment) {
          await ctx.db.patch(existingPayment._id, {
            status: args.paymentStatus,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("payments", {
            paymentId: args.paymentId,
            voucherCode: voucher.code,
            status: args.paymentStatus,
            isOfficial: false,
            owesRefund: false,
            createdAt: Date.now(),
          });
        }
        return {
          outcome: "updated" as const,
          becameValid: false,
          isTest: voucher.isTest,
        };
      } else {
        // Reversal of an Excess Payment
        if (existingPayment) {
          await ctx.db.patch(existingPayment._id, {
            status: args.paymentStatus,
            owesRefund: false,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("payments", {
            paymentId: args.paymentId,
            voucherCode: voucher.code,
            status: args.paymentStatus,
            isOfficial: false,
            owesRefund: false,
            createdAt: Date.now(),
          });
        }
        return {
          outcome: "updated" as const,
          becameValid: false,
          isTest: voucher.isTest,
        };
      }
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
        voucher.expiresAt > Date.now() &&
        (!existingOfficialPayment ||
          existingOfficialPayment.paymentId === args.paymentId);

      if (canBeOfficial) {
        await ctx.db.patch(voucher._id, {
          status: "valid",
          paymentId: args.paymentId,
        });

        if (existingPayment) {
          await ctx.db.patch(existingPayment._id, {
            status: "approved",
            isOfficial: true,
            owesRefund: false,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("payments", {
            paymentId: args.paymentId,
            voucherCode: voucher.code,
            status: "approved",
            isOfficial: true,
            owesRefund: false,
            createdAt: Date.now(),
          });
        }

        return {
          outcome: "updated" as const,
          becameValid: true,
          isTest: voucher.isTest,
        };
      }

      // Excess Payment: voucher is Valid, Redeemed, Expired, Cancelled or Refunded
      if (existingPayment) {
        await ctx.db.patch(existingPayment._id, {
          status: "approved",
          isOfficial: false,
          owesRefund: true,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("payments", {
          paymentId: args.paymentId,
          voucherCode: voucher.code,
          status: "approved",
          isOfficial: false,
          owesRefund: true,
          createdAt: Date.now(),
        });
      }

      const existingRefund = await ctx.db
        .query("paymentRefunds")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", args.paymentId))
        .first();

      if (!existingRefund) {
        const now = Date.now();
        const refundId = await ctx.db.insert("paymentRefunds", {
          paymentId: args.paymentId,
          voucherCode: voucher.code,
          amountCents: voucher.priceCents,
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

      return {
        outcome: "updated" as const,
        becameValid: false,
        isTest: voucher.isTest,
      };
    }

    // Non-approved payment (e.g. in_process, pending, rejected)
    if (existingPayment) {
      await ctx.db.patch(existingPayment._id, {
        status: args.paymentStatus,
        isOfficial: false,
        owesRefund: false,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("payments", {
        paymentId: args.paymentId,
        voucherCode: voucher.code,
        status: args.paymentStatus,
        isOfficial: false,
        owesRefund: false,
        createdAt: Date.now(),
      });
    }

    if (voucher.status === "pending" && voucher.paymentId === undefined) {
      await ctx.db.patch(voucher._id, { paymentId: args.paymentId });
    }

    return {
      outcome: "updated" as const,
      becameValid: false,
      isTest: voucher.isTest,
    };
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
    createdAt: voucher._creationTime,
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
  reversal: v.optional(
    v.object({ reason: v.string(), notedAt: v.number() }),
  ),
});

function summarizeForGateAdmin(voucher: Doc<"vouchers">) {
  return {
    ...summarizeForGate(voucher),
    paymentId: voucher.paymentId,
    preferenceId: voucher.preferenceId,
    referrer: voucher.referrer,
    reversal: voucher.reversal,
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

    await ctx.db.patch(voucher._id, { status: "redeemed" });

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
    await ctx.db.patch(voucher._id, { status: "valid", expiresAt });

    return { code: voucher.code, status: "valid" as const, expiresAt };
  },
});

/**
 * Every real voucher (excludes Test Vouchers and soft-deleted rows), for the
 * admin table. No cursor pagination and no search index: production holds
 * roughly a thousand vouchers growing at about fifty a month, so the full
 * filtered set is loaded in one reactive query and the browser paginates and
 * substring-searches it — the only way to get true `contains` semantics and
 * an accurate page count at this scale (see the spec's "Admin data access").
 * Status and creation-date-range filters run here so the returned set — and
 * therefore the client's page count — already reflects them; substring
 * search stays client-side since it isn't representable as an index range.
 * Admin-only: an employee identity is rejected, same as `listTodayAdmin`.
 */
export const listAdmin = query({
  args: {
    status: v.optional(voucherStatusValidator),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
  },
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const vouchers = await ctx.db.query("vouchers").collect();

    return vouchers
      .filter(countsAsRealVoucher)
      .filter((voucher) => args.status === undefined || voucher.status === args.status)
      .filter(
        (voucher) =>
          args.createdAfter === undefined ||
          voucher._creationTime >= args.createdAfter,
      )
      .filter(
        (voucher) =>
          args.createdBefore === undefined ||
          voucher._creationTime <= args.createdBefore,
      )
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(summarizeForGateAdmin);
  },
});

/**
 * Soft-deleted vouchers, for the admin's separate audit/restore view — the
 * mirror image of `countsAsRealVoucher`'s `deletedAt` check: everything
 * `listAdmin` hides for being deleted, this shows. Test Vouchers are
 * included here (unlike `listAdmin`) since a soft-deleted Test Voucher is
 * still something an admin may want to audit or restore. Admin-only.
 */
export const listDeleted = query({
  args: {},
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const vouchers = await ctx.db.query("vouchers").collect();

    return vouchers
      .filter((voucher) => voucher.deletedAt !== undefined)
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(summarizeForGateAdmin);
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
 * restricted to the role that can also soft-delete and restore.
 */
export const updateStatus = mutation({
  args: { code: v.string(), status: voucherStatusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    await ctx.db.patch(voucher._id, { status: args.status });
    return null;
  },
});

/**
 * Soft-deletes a voucher: reversible, and removes it from `listAdmin` (via
 * `countsAsRealVoucher`) while keeping it visible in `listDeleted`.
 * Admin-only.
 */
export const softDelete = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    await ctx.db.patch(voucher._id, { deletedAt: Date.now() });
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
    await ctx.db.patch(voucher._id, { deletedAt: undefined });
    return null;
  },
});

// --- Admin summaries and daily sales ---
//
// These two queries always read every voucher and reduce in memory (see the
// spec's "Admin data access" section), so they never accept an unbounded
// range: both bounds omitted defaults to the current calendar month in Sao
// Paulo, but supplying only one bound or explicitly passing `null` for both
// is refused rather than scanning the whole table.

/** The first and last day (as date keys) of the current calendar month in Sao Paulo. */
function currentSaoPauloMonthRange(): { fromKey: string; toKey: string } {
  const today = getSaoPauloDateKey();
  const [year, month] = today.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    fromKey: `${year}-${pad(month)}-01`,
    toKey: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Resolves the two optional date-key bounds a summary query receives into a
 * concrete `[fromKey, toKey]` range: both omitted defaults to the current
 * Sao Paulo month, exactly one supplied is refused (an accidental partial
 * bound), and an explicit `null` on either side — a caller asking for an
 * unbounded range on purpose — is refused too.
 */
function resolveDateRange(args: {
  from?: string | null;
  to?: string | null;
}): { fromKey: string; toKey: string } {
  const { from, to } = args;

  if (from === undefined && to === undefined) {
    return currentSaoPauloMonthRange();
  }

  if (from === undefined || to === undefined) {
    throw new Error(
      "A summary range needs both a start and an end date; provide both or neither.",
    );
  }

  if (from === null || to === null) {
    throw new Error(
      "An unbounded date range isn't allowed here: these queries read every matching voucher.",
    );
  }

  if (from > to) {
    throw new Error("The start date must not be after the end date.");
  }

  return { fromKey: from, toKey: to };
}

/**
 * Whether a voucher counts toward "vouchers sold" in the admin summaries: a
 * real voucher (see `countsAsRealVoucher`) whose payment has been confirmed
 * at least once. A still-`pending` voucher hasn't been sold yet, so it
 * contributes to no summary figure.
 */
function countsAsSoldVoucher(voucher: Doc<"vouchers">): boolean {
  return (
    countsAsRealVoucher(voucher) &&
    voucher.status !== "pending" &&
    voucher.status !== "cancelled"
  );
}

/** Every sold voucher (see `countsAsSoldVoucher`) created within `[fromKey, toKey]`, inclusive, Sao Paulo calendar days. */
async function soldVouchersInRange(
  ctx: { db: QueryCtx["db"] },
  fromKey: string,
  toKey: string,
): Promise<Doc<"vouchers">[]> {
  const fromMs = startOfSaoPauloDayMs(fromKey);
  const toMs = endOfSaoPauloDayMs(toKey);

  const vouchers = await ctx.db.query("vouchers").collect();

  return vouchers.filter(
    (voucher) =>
      countsAsSoldVoucher(voucher) &&
      voucher._creationTime >= fromMs &&
      voucher._creationTime <= toMs,
  );
}

const dateRangeArgs = {
  from: v.optional(v.union(v.string(), v.null())),
  to: v.optional(v.union(v.string(), v.null())),
};

/**
 * Vouchers sold, visitors expected, and revenue (integer cents) for a
 * bounded date range. Admin-only. See `resolveDateRange` for how the range
 * is derived from `from`/`to`, and `countsAsSoldVoucher` for which vouchers
 * count.
 */
export const periodSummary = query({
  args: dateRangeArgs,
  returns: v.object({
    from: v.string(),
    to: v.string(),
    voucherCount: v.number(),
    visitorCount: v.number(),
    revenueCents: v.number(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const { fromKey, toKey } = resolveDateRange(args);
    const vouchers = await soldVouchersInRange(ctx, fromKey, toKey);

    const totals = vouchers.reduce(
      (acc, voucher) => {
        acc.revenueCents += voucher.priceCents;
        acc.adults += voucher.adults;
        acc.elderly += voucher.elderly;
        acc.adultsPool += voucher.adultsPool;
        acc.elderlyPool += voucher.elderlyPool;
        return acc;
      },
      { revenueCents: 0, adults: 0, elderly: 0, adultsPool: 0, elderlyPool: 0 },
    );

    return {
      from: fromKey,
      to: toKey,
      voucherCount: vouchers.length,
      visitorCount:
        totals.adults + totals.elderly + totals.adultsPool + totals.elderlyPool,
      ...totals,
    };
  },
});

/**
 * The same range as `periodSummary`, broken down by Sao Paulo calendar day
 * so trends are visible. Only days with at least one sold voucher appear.
 * Admin-only.
 */
export const dailyBreakdown = query({
  args: dateRangeArgs,
  returns: v.array(
    v.object({
      date: v.string(),
      voucherCount: v.number(),
      visitorCount: v.number(),
      revenueCents: v.number(),
      adults: v.number(),
      elderly: v.number(),
      adultsPool: v.number(),
      elderlyPool: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const { fromKey, toKey } = resolveDateRange(args);
    const vouchers = await soldVouchersInRange(ctx, fromKey, toKey);

    const byDay = new Map<
      string,
      {
        voucherCount: number;
        revenueCents: number;
        adults: number;
        elderly: number;
        adultsPool: number;
        elderlyPool: number;
      }
    >();

    for (const voucher of vouchers) {
      const day = getSaoPauloDateKey(new Date(voucher._creationTime));
      const bucket = byDay.get(day) ?? {
        voucherCount: 0,
        revenueCents: 0,
        adults: 0,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
      };
      bucket.voucherCount += 1;
      bucket.revenueCents += voucher.priceCents;
      bucket.adults += voucher.adults;
      bucket.elderly += voucher.elderly;
      bucket.adultsPool += voucher.adultsPool;
      bucket.elderlyPool += voucher.elderlyPool;
      byDay.set(day, bucket);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({
        date,
        ...bucket,
        visitorCount:
          bucket.adults + bucket.elderly + bucket.adultsPool + bucket.elderlyPool,
      }));
  },
});
