import { ConvexError, v } from "convex/values";

import { daysInPeriod, periodError } from "../src/lib/finance-period";
import {
  addDaysToDateKey,
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
  startOfSaoPauloDayMs,
} from "../src/lib/utils/date";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireRole } from "./lib/auth";
import {
  addShare,
  countsTowardRevenue,
  saoPauloDateKeyFast,
  sortedShares,
  summarizeDay,
  voucherPurchaseMs,
  type Share,
} from "./lib/financeSummary";
import { voucherStatusValidator } from "./vouchers";

const RECENT_LIMIT = 5;
// Upper bound on vouchers read to find the `RECENT_LIMIT` latest sales.
const RECENT_SCAN_LIMIT = 200;
// Days recomputed per `rebuildAll` batch.
const REBUILD_DAYS_PER_BATCH = 10;
// Days re-summarized by the daily safety-net cron.
const RECOMPUTE_RECENT_DAYS = 7;

const granularityValidator = v.union(
  v.literal("hour"),
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
);
type Granularity = typeof granularityValidator.type;

const bucketValidator = v.object({
  from: v.string(),
  to: v.string(),
  // Sao Paulo hour of day; set only when granularity is "hour".
  hour: v.union(v.number(), v.null()),
  netCents: v.number(),
  voucherCount: v.number(),
});
type Bucket = typeof bucketValidator.type;

// Revenue attributed to one group (referrer source or payment method key).
const shareValidator = v.object({
  key: v.string(),
  netCents: v.number(),
  voucherCount: v.number(),
});

function granularityFor(days: number): Granularity {
  if (days === 1) return "hour";
  if (days <= 31) return "day";
  if (days <= 92) return "week";
  return "month";
}

/** Zero-filled chart buckets covering `[fromKey, toKey]` at the given granularity. */
function emptyBuckets(
  fromKey: string,
  toKey: string,
  granularity: Granularity,
): Bucket[] {
  const empty = { netCents: 0, voucherCount: 0 };

  if (granularity === "hour") {
    return Array.from({ length: 24 }, (_, hour) => ({
      from: fromKey,
      to: fromKey,
      hour,
      ...empty,
    }));
  }

  const buckets: Bucket[] = [];
  let cursor = fromKey;
  while (cursor <= toKey) {
    let end: string;
    if (granularity === "day") {
      end = cursor;
    } else if (granularity === "week") {
      end = addDaysToDateKey(cursor, 6);
    } else {
      const [year, month] = cursor.split("-").map(Number) as [number, number];
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      end = `${cursor.slice(0, 8)}${String(lastDay).padStart(2, "0")}`;
    }
    if (end > toKey) end = toKey;
    buckets.push({ from: cursor, to: end, hour: null, ...empty });
    cursor = addDaysToDateKey(end, 1);
  }
  return buckets;
}

/** The bucket whose inclusive `[from, to]` holds `key`; buckets are sorted and contiguous. */
function findBucket(buckets: Bucket[], key: string): Bucket | undefined {
  let low = 0;
  let high = buckets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const bucket = buckets[mid]!;
    if (key < bucket.from) high = mid - 1;
    else if (key > bucket.to) low = mid + 1;
    else return bucket;
  }
  return undefined;
}

/** Drops quiet hours at both ends of a single-day chart, keeping at least the 8h–18h opening window. */
function trimHours(buckets: Bucket[]): Bucket[] {
  const busy = buckets.filter((b) => b.voucherCount > 0).map((b) => b.hour ?? 0);
  const first = Math.min(8, ...busy);
  const last = Math.max(18, ...busy);
  return buckets.filter((b) => b.hour !== null && b.hour >= first && b.hour <= last);
}

/**
 * Rebuilds the `financeDays` document of one Sao Paulo purchase day from its
 * vouchers, deleting it when the day has no revenue. Vouchers are the source
 * of truth. Vouchers without `purchasedAt` are invisible here, so the
 * `purchasedAt` backfill must have run.
 */
async function recomputeDayInline(ctx: MutationCtx, date: string) {
  const vouchers = await ctx.db
    .query("vouchers")
    .withIndex("by_purchasedAt", (q) =>
      q
        .gte("purchasedAt", startOfSaoPauloDayMs(date))
        .lte("purchasedAt", endOfSaoPauloDayMs(date)),
    )
    .collect();
  const summary = summarizeDay(date, vouchers);

  const existing = await ctx.db
    .query("financeDays")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();

  if (summary.voucherCount === 0) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }
  if (!existing) {
    await ctx.db.insert("financeDays", { ...summary, updatedAt: Date.now() });
    return;
  }
  // Skip the write when nothing changed, so idle recomputes cause no churn.
  const unchanged = (
    ["netCents", "voucherCount", "hours", "referrers", "paymentMethods"] as const
  ).every((key) => JSON.stringify(existing[key]) === JSON.stringify(summary[key]));
  if (!unchanged) {
    await ctx.db.replace(existing._id, { ...summary, updatedAt: Date.now() });
  }
}

/** Recomputes one purchase day. Scheduled by `patchVoucher` (convex/lib/voucherWrites.ts). */
export const recomputeDay = internalMutation({
  args: { date: v.string() },
  returns: v.null(),
  handler: async (ctx, { date }) => {
    await recomputeDayInline(ctx, date);
    return null;
  },
});

/**
 * Daily safety net (see convex/crons.ts): recomputes the last week of days in
 * case a voucher write bypassed `patchVoucher`.
 */
export const recomputeRecentDays = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = getSaoPauloDateKey();
    for (let i = 0; i < RECOMPUTE_RECENT_DAYS; i++) {
      await recomputeDayInline(ctx, addDaysToDateKey(today, -i));
    }
    return null;
  },
});

/**
 * Rebuilds every `financeDays` document, from the earliest `purchasedAt` to
 * today, a few days per run, rescheduling itself for the rest. Run it after
 * the `purchasedAt` backfill (`migrations:backfillVoucherPurchasedAtAndSearchText`)
 * on first deploy and after any bulk import (convex/import.ts does not
 * schedule per-voucher recomputes):
 * `npx convex run finance:rebuildAll`.
 */
export const rebuildAll = internalMutation({
  args: { fromDate: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    let date = args.fromDate;
    if (date === undefined) {
      // `gte 0` skips vouchers still missing `purchasedAt`, which sort first.
      const earliest = await ctx.db
        .query("vouchers")
        .withIndex("by_purchasedAt", (q) => q.gte("purchasedAt", 0))
        .first();
      if (!earliest) return null;
      date = saoPauloDateKeyFast(voucherPurchaseMs(earliest));
    }

    const today = getSaoPauloDateKey();
    for (let i = 0; i < REBUILD_DAYS_PER_BATCH && date <= today; i++) {
      await recomputeDayInline(ctx, date);
      date = addDaysToDateKey(date, 1);
    }
    if (date <= today) {
      await ctx.scheduler.runAfter(0, internal.finance.rebuildAll, {
        fromDate: date,
      });
    }
    return null;
  },
});

/**
 * The admin financial report for `[from, to]` (Sao Paulo "YYYY-MM-DD" keys,
 * inclusive), compared against the period of the same length immediately
 * before it. Money is integer cents. Reads the persisted daily summaries
 * (`financeDays`, see convex/lib/financeSummary.ts), so only vouchers that
 * count toward revenue appear in any figure, dated by `purchasedAt`.
 */
export const financialReport = query({
  args: { from: v.string(), to: v.string() },
  returns: v.object({
    from: v.string(),
    to: v.string(),
    previousFrom: v.string(),
    previousTo: v.string(),
    granularity: granularityValidator,
    netCents: v.number(),
    previousNetCents: v.number(),
    voucherCount: v.number(),
    buckets: v.array(bucketValidator),
    referrers: v.array(shareValidator),
    paymentMethods: v.array(shareValidator),
    recent: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        createdAt: v.number(),
        priceCents: v.number(),
        status: voucherStatusValidator,
      }),
    ),
  }),
  handler: async (ctx, { from, to }) => {
    await requireRole(ctx, "admin");

    const invalid = periodError({ from, to });
    if (invalid) {
      throw new ConvexError(invalid);
    }
    const days = daysInPeriod({ from, to });

    const previousFrom = addDaysToDateKey(from, -days);
    const previousTo = addDaysToDateKey(from, -1);

    const summaries = await ctx.db
      .query("financeDays")
      .withIndex("by_date", (q) => q.gte("date", previousFrom).lte("date", to))
      .collect();

    const granularity = granularityFor(days);
    const buckets = emptyBuckets(from, to, granularity);
    const referrers = new Map<string, Share>();
    const paymentMethods = new Map<string, Share>();
    let netCents = 0;
    let previousNetCents = 0;
    let voucherCount = 0;

    for (const day of summaries) {
      if (day.date < from) {
        previousNetCents += day.netCents;
        continue;
      }

      netCents += day.netCents;
      voucherCount += day.voucherCount;

      if (granularity === "hour") {
        day.hours.forEach((hour, index) => {
          const bucket = buckets[index];
          if (bucket) {
            bucket.netCents += hour.netCents;
            bucket.voucherCount += hour.voucherCount;
          }
        });
      } else {
        const bucket = findBucket(buckets, day.date);
        if (bucket) {
          bucket.netCents += day.netCents;
          bucket.voucherCount += day.voucherCount;
        }
      }

      for (const share of day.referrers) {
        addShare(referrers, share.key, share.netCents, share.voucherCount);
      }
      for (const share of day.paymentMethods) {
        addShare(paymentMethods, share.key, share.netCents, share.voucherCount);
      }
    }

    // Latest sales, newest first; stops after a bounded scan so a long
    // stretch of non-revenue vouchers cannot make the query expensive.
    const recent: {
      code: string;
      name: string;
      createdAt: number;
      priceCents: number;
      status: Doc<"vouchers">["status"];
    }[] = [];
    let scanned = 0;
    for await (const voucher of ctx.db
      .query("vouchers")
      .withIndex("by_purchasedAt", (q) =>
        q
          .gte("purchasedAt", startOfSaoPauloDayMs(from))
          .lte("purchasedAt", endOfSaoPauloDayMs(to)),
      )
      .order("desc")) {
      if (countsTowardRevenue(voucher)) {
        recent.push({
          code: voucher.code,
          name: voucher.name,
          createdAt: voucherPurchaseMs(voucher),
          priceCents: voucher.priceCents,
          status: voucher.status,
        });
      }
      scanned += 1;
      if (recent.length >= RECENT_LIMIT || scanned >= RECENT_SCAN_LIMIT) break;
    }

    return {
      from,
      to,
      previousFrom,
      previousTo,
      granularity,
      netCents,
      previousNetCents,
      voucherCount,
      buckets: granularity === "hour" ? trimHours(buckets) : buckets,
      referrers: sortedShares(referrers),
      paymentMethods: sortedShares(paymentMethods),
      recent,
    };
  },
});
