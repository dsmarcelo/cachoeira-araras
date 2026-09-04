import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Once a day: a voucher past its Expiry becomes `expired` (a `redeemed`
 * voucher is never transitioned), a Pending Voucher whose Expiry has passed
 * is soft-deleted, and a Test Voucher older than thirty days is hard-deleted
 * so Test Vouchers don't accumulate forever. Real (non-test) vouchers are
 * never hard-deleted — only the `isTest` branch below calls `ctx.db.delete`.
 *
 * `expiresAt` is already an absolute instant computed against the Sao Paulo
 * calendar wherever it's written (`endOfSaoPauloDayMs` in convex/vouchers.ts,
 * for both the original purchase and `reactivate`), so this job only needs
 * the true current instant to compare against it — no timezone conversion of
 * its own. The Vercel-cron predecessor of this job instead reparsed a Sao
 * Paulo wall-clock string as server-local time, producing a "now" three
 * hours off; `Date.now()` avoids reproducing that bug.
 *
 * Internal only: invoked by the cron in convex/crons.ts, never exposed to a
 * client, which is also what makes it reachable directly from convex-test.
 */
export const runDailyMaintenance = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const vouchers = await ctx.db.query("vouchers").collect();

    for (const voucher of vouchers) {
      if (voucher.isTest && now - voucher._creationTime >= THIRTY_DAYS_MS) {
        await ctx.db.delete(voucher._id);
        continue;
      }

      if (voucher.status === "valid" && voucher.expiresAt <= now) {
        await ctx.db.patch(voucher._id, { status: "expired" });
        continue;
      }

      if (
        voucher.status === "pending" &&
        voucher.deletedAt === undefined &&
        voucher.expiresAt <= now
      ) {
        await ctx.db.patch(voucher._id, { deletedAt: now });
      }
    }

    return null;
  },
});
