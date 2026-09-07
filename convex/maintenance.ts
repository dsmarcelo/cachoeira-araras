import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Kept well under Convex's per-mutation read/write limits even with all
// three passes below hitting their cap in the same run.
const BATCH_SIZE = 200;

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
 * Each of the three passes below reads at most `BATCH_SIZE` documents from
 * an index scoped to exactly the records it can act on (see
 * `by_status_and_deletedAt_and_expiresAt` and `by_isTest` in
 * convex/schema.ts), so the job stays cheap regardless of how large the
 * `vouchers` table grows or how many already-handled records exist. Every
 * write in a pass also moves that document out of the index range the pass
 * queries (status flips off `"valid"`/`"pending"`, `deletedAt` becomes
 * defined, or the row is deleted outright), so a later run of this same
 * query never sees an already-handled document again — no separate cursor
 * needs to be threaded through. If any pass fills its batch, there may be
 * more work behind it, so this reschedules itself immediately; once every
 * pass comes back under `BATCH_SIZE`, no continuation is scheduled and the
 * chain started by that day's cron trigger ends.
 *
 * (Using cursor-based `.paginate()` for all three passes isn't an option:
 * Convex allows only one `.paginate()` call per function execution.)
 *
 * Internal only: invoked by the cron in convex/crons.ts, never exposed to a
 * client, which is also what makes it reachable directly from convex-test.
 */
export const runDailyMaintenance = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    const overdueValid = await ctx.db
      .query("vouchers")
      .withIndex("by_status_and_deletedAt_and_expiresAt", (q) =>
        q.eq("status", "valid").eq("deletedAt", undefined).lte("expiresAt", now),
      )
      .take(BATCH_SIZE);
    for (const voucher of overdueValid) {
      await ctx.db.patch(voucher._id, { status: "expired" });
    }

    const overduePending = await ctx.db
      .query("vouchers")
      .withIndex("by_status_and_deletedAt_and_expiresAt", (q) =>
        q.eq("status", "pending").eq("deletedAt", undefined).lte("expiresAt", now),
      )
      .take(BATCH_SIZE);
    for (const voucher of overduePending) {
      await ctx.db.patch(voucher._id, { deletedAt: now });
    }

    const testCutoff = now - THIRTY_DAYS_MS;
    const oldTest = await ctx.db
      .query("vouchers")
      .withIndex("by_isTest", (q) =>
        q.eq("isTest", true).lte("_creationTime", testCutoff),
      )
      .take(BATCH_SIZE);
    for (const voucher of oldTest) {
      await ctx.db.delete(voucher._id);
    }

    const mayHaveMoreWork =
      overdueValid.length === BATCH_SIZE ||
      overduePending.length === BATCH_SIZE ||
      oldTest.length === BATCH_SIZE;
    if (mayHaveMoreWork) {
      await ctx.scheduler.runAfter(
        0,
        internal.maintenance.runDailyMaintenance,
        {},
      );
    }

    return null;
  },
});
