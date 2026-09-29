import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { voucherSearchText } from "./lib/voucherSearch";

const BACKFILL_BATCH_SIZE = 200;

/**
 * One-off backfill for vouchers written before `purchasedAt`, `searchText`
 * and `isActive` existed. Walks the table in batches, fills only the fields
 * that are missing (plus a stale `searchText`), so re-running is harmless, and reschedules itself with
 * the next cursor until done. Start it with
 * `npx convex run migrations:backfillVoucherPurchasedAtAndSearchText`.
 */
export const backfillVoucherPurchasedAtAndSearchText = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("vouchers").paginate({
      numItems: BACKFILL_BATCH_SIZE,
      cursor: args.cursor ?? null,
    });

    for (const voucher of page.page) {
      const patch: {
        purchasedAt?: number;
        searchText?: string;
        isActive?: boolean;
      } = {};
      if (voucher.purchasedAt === undefined) {
        patch.purchasedAt = voucher._creationTime;
      }
      // Recomputed when stale, not only when missing, so a change to the
      // search tokens reaches existing vouchers by re-running this.
      const searchText = voucherSearchText(voucher);
      if (voucher.searchText !== searchText) {
        patch.searchText = searchText;
      }
      if (voucher.isActive === undefined) {
        patch.isActive = voucher.deletedAt === undefined && !voucher.isTest;
      }
      if (Object.keys(patch).length > 0) {
        // Direct patch on purpose: a backfill changes no revenue; run
        // `finance:rebuildAll` after it to build the finance summaries.
        await ctx.db.patch(voucher._id, patch);
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillVoucherPurchasedAtAndSearchText,
        { cursor: page.continueCursor },
      );
    }
    return null;
  },
});
