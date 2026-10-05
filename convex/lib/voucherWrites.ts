import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  revenueContribution,
  saoPauloDateKeyFast,
  voucherPurchaseMs,
} from "./financeSummary";

type VoucherPatch = Partial<Omit<Doc<"vouchers">, "_id" | "_creationTime">>;

/**
 * The single write point for voucher documents: every `ctx.db.patch` on a
 * voucher goes through here (`grep "ctx.db.patch"` in convex/ must show none
 * on vouchers). It patches the voucher and, when the patch changes what the
 * voucher contributes to revenue (status, paymentId, reversal, deletedAt,
 * isTest, priceCents, referrer, payment type/method, purchasedAt), schedules
 * `finance.recomputeDay` for the purchase day it left and the one it joined.
 * It also derives `paymentDisputed` from `paymentIssue` whenever the patch
 * touches `paymentIssue`. The recompute is scheduled, not inline, so payment mutations do not grow
 * their read set or conflict with each other on the summary document.
 *
 * `voucher` must be the document as it was read before this patch.
 * `convex/import.ts` inserts in bulk and skips this; run `finance.rebuildAll`
 * after an import.
 */
export async function patchVoucher(
  ctx: MutationCtx,
  voucher: Doc<"vouchers">,
  patch: VoucherPatch,
): Promise<void> {
  // Keep the derived `paymentDisputed` (admin filter index) in step with
  // `paymentIssue`; `undefined` removes the field.
  const derived: VoucherPatch =
    "paymentIssue" in patch
      ? {
          paymentDisputed:
            patch.paymentIssue?.kind === "dispute" ? true : undefined,
        }
      : {};
  const fullPatch = { ...patch, ...derived };
  await ctx.db.patch("vouchers", voucher._id, fullPatch);

  // Spread keeps `undefined` values, which is how `patch` removes a field.
  const next = { ...voucher, ...fullPatch };
  const before = revenueContribution(voucher);
  const after = revenueContribution(next);
  if (before === after) return;

  const dates = new Set<string>();
  if (before !== null) {
    dates.add(saoPauloDateKeyFast(voucherPurchaseMs(voucher)));
  }
  if (after !== null) {
    dates.add(saoPauloDateKeyFast(voucherPurchaseMs(next)));
  }
  for (const date of dates) {
    await ctx.scheduler.runAfter(0, internal.finance.recomputeDay, { date });
  }
}
