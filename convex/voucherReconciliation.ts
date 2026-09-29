import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalMutation, type ActionCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";
import type { PaymentSnapshot } from "./lib/paymentOperation";

const RECHECK_INTERVAL_MS = 60_000;
const MAX_ADMIN_BATCH = 50;

/** Claims a provider check only for a pending voucher the caller may manage. */
export const claim = internalMutation({
  args: { code: v.string(), managementToken: v.optional(v.string()) },
  returns: v.union(v.id("paymentOperations"), v.null()),
  handler: async (ctx, args) => {
    if (args.managementToken === undefined) {
      await requireRole(ctx, "admin");
    }

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (
      args.code.length === 0 ||
      args.code.length > 64 ||
      !voucher ||
      voucher.deletedAt !== undefined ||
      voucher.status !== "pending" ||
      (args.managementToken !== undefined &&
        voucher.managementToken !== args.managementToken)
    ) {
      return null;
    }

    const now = Date.now();
    if (
      voucher.paymentReconciliationCheckedAt !== undefined &&
      now - voucher.paymentReconciliationCheckedAt < RECHECK_INTERVAL_MS
    ) {
      return null;
    }

    const previousOperation = voucher.paymentReconciliationOpId
      ? await ctx.db.get(voucher.paymentReconciliationOpId)
      : null;
    const operationId = previousOperation && previousOperation.result === undefined
      ? previousOperation._id
      : await ctx.db.insert("paymentOperations", {
          request: { kind: "search", externalReference: voucher.code },
        });
    await ctx.db.patch(voucher._id, {
      paymentReconciliationCheckedAt: now,
      paymentReconciliationOpId: operationId,
    });
    return operationId;
  },
});

async function reconcile(
  ctx: ActionCtx,
  code: string,
  managementToken?: string,
): Promise<"checked" | "updated" | "skipped"> {
  const operationId = await ctx.runMutation(internal.voucherReconciliation.claim, {
    code,
    managementToken,
  });
  if (!operationId) return "skipped";

  const payments = (await ctx.runAction(internal.paymentOperations.execute, {
    id: operationId,
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

/** The originating browser may check its own pending purchase on page entry. */
export const reconcileMine = action({
  args: { code: v.string(), managementToken: v.string() },
  returns: v.union(
    v.literal("checked"),
    v.literal("updated"),
    v.literal("skipped"),
  ),
  handler: async (ctx, args) =>
    reconcile(ctx, args.code, args.managementToken),
});

/** Admin table checks its visible pending vouchers in bounded batches. */
export const reconcileAdmin = action({
  args: { codes: v.array(v.string()) },
  returns: v.object({ updated: v.number(), failed: v.number() }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    if (args.codes.length > MAX_ADMIN_BATCH) {
      throw new Error("Muitos vouchers para verificar de uma vez.");
    }

    let updated = 0;
    let failed = 0;
    for (const code of new Set(args.codes)) {
      try {
        if ((await reconcile(ctx, code)) === "updated") updated += 1;
      } catch (error) {
        console.error("Falha ao conferir pagamento do voucher", code, error);
        failed += 1;
      }
    }
    return { updated, failed };
  },
});
