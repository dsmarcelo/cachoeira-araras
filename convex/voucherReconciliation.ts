import { ConvexError, v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, type ActionCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { getPayment } from "./lib/mercadopagoOperations";
import { isRevertibleReversal, paidVoucherStatuses } from "./lib/paymentReversal";
import type { PaymentSnapshot } from "./lib/paymentOperation";
import { patchVoucher } from "./lib/voucherWrites";
import { observedFromSnapshot, syncObservedPayment } from "./paymentSync";

const RECHECK_INTERVAL_MS = 60_000;
const MAX_ADMIN_BATCH = 50;
const MAX_CODE_LENGTH = 64;
const MAX_TOKEN_LENGTH = 200;

/**
 * What a check reports to the UI. `skipped` means no provider call was made
 * (unknown code, wrong token, not eligible, or checked within the last
 * minute); the UI must treat it as settled, never as an error. `failed`
 * means Mercado Pago could not be asked or answered badly, now or in the
 * throttled check before it: the voucher is untouched and Validar still lets
 * staff redeem. `updated` means the voucher changed
 * (a pending purchase became valid, or a paid voucher was reversed, reverted
 * or flagged); `checked` means the provider answered and nothing changed.
 * A Redeemed voucher always reports `checked`, even when a reversal was
 * recorded, because `confirmPayment` does not tell the two apart.
 */
const reconcileResult = v.union(
  v.literal("checked"),
  v.literal("updated"),
  v.literal("skipped"),
  v.literal("failed"),
);
type ReconcileResult = Infer<typeof reconcileResult>;

/** Who is asking; staff has already been authenticated by the calling action. */
const access = v.union(
  v.object({ kind: v.literal("management"), token: v.string() }),
  v.object({ kind: v.literal("lookup"), token: v.string() }),
  v.object({ kind: v.literal("staff") }),
);
type Access = Infer<typeof access>;

/**
 * Claims one provider check for a voucher the caller may see, or returns null
 * (indistinguishably for unknown code, wrong token, ineligible state and
 * throttle, so nothing leaks). Pending vouchers search by external reference;
 * paid ones (valid, redeemed, expired, or refunded by a chargeback that could
 * still be won) fetch their Official Payment by id.
 *
 * The throttle stamp is written here, before the provider is called, so a
 * failed check also consumes the one-minute window. That keeps a provider
 * outage from being hammered by every page view; the next view after the
 * window retries.
 */
export const claim = internalMutation({
  args: { code: v.string(), access },
  returns: v.union(
    v.null(),
    v.object({ kind: v.literal("recentlyFailed") }),
    v.object({ kind: v.literal("search"), operationId: v.id("paymentOperations") }),
    v.object({ kind: v.literal("payment"), paymentId: v.string() }),
  ),
  handler: async (ctx, args) => {
    const { code, access } = args;
    if (
      code.length === 0 ||
      code.length > MAX_CODE_LENGTH ||
      (access.kind !== "staff" &&
        (access.token.length === 0 || access.token.length > MAX_TOKEN_LENGTH))
    ) {
      return null;
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!voucher || voucher.deletedAt !== undefined) return null;

    const authorized =
      access.kind === "staff" ||
      (access.kind === "management" &&
        voucher.managementToken === access.token) ||
      (access.kind === "lookup" &&
        voucher.lookupToken !== undefined &&
        voucher.lookupToken === access.token);
    if (!authorized) return null;

    const paymentId = voucher.paymentId;
    const isPending = voucher.status === "pending";
    const isPaid =
      paymentId !== undefined &&
      paidVoucherStatuses.has(voucher.status) &&
      (voucher.status !== "refunded" || isRevertibleReversal(voucher.reversal));
    if (!isPending && !isPaid) return null;

    const now = Date.now();
    if (
      voucher.paymentReconciliationCheckedAt !== undefined &&
      now - voucher.paymentReconciliationCheckedAt < RECHECK_INTERVAL_MS
    ) {
      // The caller is authorized here, so reporting the last failure leaks nothing.
      return voucher.paymentReconciliationFailedAt !== undefined
        ? { kind: "recentlyFailed" as const }
        : null;
    }

    if (isPaid) {
      await patchVoucher(ctx, voucher, { paymentReconciliationCheckedAt: now });
      return { kind: "payment" as const, paymentId };
    }

    const previousOperation = voucher.paymentReconciliationOpId
      ? await ctx.db.get(voucher.paymentReconciliationOpId)
      : null;
    const operationId = previousOperation && previousOperation.result === undefined
      ? previousOperation._id
      : await ctx.db.insert("paymentOperations", {
          request: { kind: "search", externalReference: voucher.code },
        });
    await patchVoucher(ctx, voucher, {
      paymentReconciliationCheckedAt: now,
      paymentReconciliationOpId: operationId,
    });
    return { kind: "search" as const, operationId };
  },
});

/** Remembers whether the last claimed check failed (see `claim`). */
export const recordOutcome = internalMutation({
  args: { code: v.string(), failed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!voucher) return null;
    const failedAt = args.failed ? Date.now() : undefined;
    if ((voucher.paymentReconciliationFailedAt === undefined) !== (failedAt === undefined)) {
      await patchVoucher(ctx, voucher, { paymentReconciliationFailedAt: failedAt });
    }
    return null;
  },
});

/**
 * Runs one check and never throws: the callers authenticate staff before
 * calling, and any other error (provider, sync, database) becomes `failed`.
 */
async function reconcile(
  ctx: ActionCtx,
  code: string,
  accessArgs: Access,
): Promise<ReconcileResult> {
  let claimed;
  try {
    claimed = await ctx.runMutation(internal.voucherReconciliation.claim, {
      code,
      access: accessArgs,
    });
  } catch (error) {
    console.error("Falha ao conferir pagamento do voucher", code, error);
    return "failed";
  }
  if (!claimed) return "skipped";
  if (claimed.kind === "recentlyFailed") return "failed";

  const result = await runClaimedCheck(ctx, code, claimed);
  try {
    await ctx.runMutation(internal.voucherReconciliation.recordOutcome, {
      code,
      failed: result === "failed",
    });
  } catch (error) {
    console.error("Falha ao registrar conferência do voucher", code, error);
  }
  return result;
}

async function runClaimedCheck(
  ctx: ActionCtx,
  code: string,
  claimed:
    | { kind: "search"; operationId: Id<"paymentOperations"> }
    | { kind: "payment"; paymentId: string },
): Promise<ReconcileResult> {
  try {

    if (claimed.kind === "search") {
      const payments = (await ctx.runAction(internal.paymentOperations.execute, {
        id: claimed.operationId,
      })) as PaymentSnapshot[];

      let updated = false;
      for (const payment of payments) {
        if (payment.status !== "approved") continue;
        const result = await ctx.runMutation(internal.vouchers.confirmPayment, {
          code,
          paymentId: payment.id,
          paymentStatus: payment.status,
          paymentAmountCents: Math.round(payment.amount * 100),
          paymentTypeId: payment.paymentTypeId,
          paymentMethodId: payment.paymentMethodId,
        });
        updated ||= result.outcome !== "not_found" && result.becameValid;
      }
      return updated ? "updated" : "checked";
    }

    const snapshot = await getPayment(claimed.paymentId, {
      idempotencyKey: crypto.randomUUID(),
      recordedAt: Date.now(),
    });
    // `observedFromSnapshot` trusts the payment's own external reference, so
    // never let a payment that belongs to another voucher write to this one.
    const observed = observedFromSnapshot(snapshot);
    if (observed?.code !== code) {
      console.error("Pagamento não pertence ao voucher", code, claimed.paymentId);
      return "failed";
    }
    const result = await syncObservedPayment(ctx, observed);
    return result.outcome === "updated" || result.outcome === "reversed"
      ? "updated"
      : "checked";
  } catch (error) {
    console.error("Falha ao conferir pagamento do voucher", code, error);
    return "failed";
  }
}

/**
 * The customer re-checks their own voucher on page entry: the originating
 * browser holds a management token, a code lookup only the lookup token.
 * At least one is required; if both are sent the management token is used.
 */
export const reconcileMine = action({
  args: {
    code: v.string(),
    managementToken: v.optional(v.string()),
    lookupToken: v.optional(v.string()),
  },
  returns: reconcileResult,
  handler: async (ctx, args) => {
    if (args.managementToken !== undefined) {
      return reconcile(ctx, args.code, {
        kind: "management",
        token: args.managementToken,
      });
    }
    if (args.lookupToken !== undefined) {
      return reconcile(ctx, args.code, {
        kind: "lookup",
        token: args.lookupToken,
      });
    }
    return "skipped";
  },
});

/**
 * Validar (gate): staff checks the voucher whose code was just looked up.
 * Employees and admins; anyone else gets a 401/403. `skipped` and `failed`
 * must not block "Usar voucher".
 */
export const reconcileAtGate = action({
  args: { code: v.string() },
  returns: reconcileResult,
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");
    return reconcile(ctx, args.code, { kind: "staff" });
  },
});

/**
 * Admin table checks its visible vouchers (pending and paid) in bounded
 * batches. `updated`/`failed` are totals; `results` has one entry per
 * distinct code.
 */
export const reconcileAdmin = action({
  args: { codes: v.array(v.string()) },
  returns: v.object({
    updated: v.number(),
    failed: v.number(),
    results: v.array(v.object({ code: v.string(), result: reconcileResult })),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    if (args.codes.length > MAX_ADMIN_BATCH) {
      throw new ConvexError("Muitos vouchers para verificar de uma vez.");
    }

    const results: Array<{ code: string; result: ReconcileResult }> = [];
    for (const code of new Set(args.codes)) {
      results.push({ code, result: await reconcile(ctx, code, { kind: "staff" }) });
    }
    return {
      updated: results.filter((r) => r.result === "updated").length,
      failed: results.filter((r) => r.result === "failed").length,
      results,
    };
  },
});
