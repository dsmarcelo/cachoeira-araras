import { ConvexError, v } from "convex/values";

import { daysInPeriod, periodError } from "../src/lib/finance-period";
import {
  addDaysToDateKey,
  endOfSaoPauloDayMs,
  startOfSaoPauloDayMs,
} from "../src/lib/utils/date";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { countsAsRealVoucher, voucherStatusValidator } from "./vouchers";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Sao Paulo "YYYY-MM-DD" key for an instant, using the same fixed UTC-3
 * offset as `startOfSaoPauloDayMs`. Used per voucher in the report loop,
 * where building an `Intl.DateTimeFormat` each time (`getSaoPauloDateKey`)
 * blows the query time budget on long ranges.
 */
function saoPauloDateKeyFast(ms: number): string {
  return new Date(ms - 3 * HOUR_MS).toISOString().slice(0, 10);
}

const RECENT_LIMIT = 5;

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
type Share = Omit<typeof shareValidator.type, "key">;

function addShare(shares: Map<string, Share>, key: string, cents: number) {
  const share = shares.get(key) ?? { netCents: 0, voucherCount: 0 };
  share.netCents += cents;
  share.voucherCount += 1;
  shares.set(key, share);
}

function sortedShares(shares: Map<string, Share>) {
  return Array.from(shares, ([key, share]) => ({ key, ...share })).sort(
    (a, b) => b.netCents - a.netCents,
  );
}

/**
 * Whether a voucher's price counts as revenue: a real voucher (see
 * `countsAsRealVoucher`) whose payment Mercado Pago approved — `paymentId` is
 * written only together with that approval (`confirmPayment`), so a status an
 * admin set by hand without a payment never counts — and whose payment was
 * not later taken back (refund, chargeback, cancellation: status `refunded` or
 * a `reversal` on a redeemed voucher).
 */
function countsTowardRevenue(voucher: Doc<"vouchers">): boolean {
  return (
    countsAsRealVoucher(voucher) &&
    voucher.paymentId !== undefined &&
    (voucher.status === "valid" ||
      voucher.status === "redeemed" ||
      voucher.status === "expired") &&
    voucher.reversal === undefined
  );
}

/**
 * Groups Mercado Pago payment types for the report. Pix arrives as
 * `payment_type_id: "bank_transfer"` + `payment_method_id: "pix"`, so it is
 * keyed by the method; everything else by the type ("credit_card",
 * "debit_card", "account_money", …). "" = not recorded.
 */
function paymentMethodKey(voucher: Doc<"vouchers">): string {
  if (voucher.paymentMethodId === "pix") return "pix";
  return voucher.paymentTypeId ?? "";
}

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
 * The admin financial report for `[from, to]` (Sao Paulo "YYYY-MM-DD" keys,
 * inclusive), compared against the period of the same length immediately
 * before it. Money is integer cents. Only vouchers that count toward revenue
 * (see `countsTowardRevenue`) appear in any figure.
 *
 * TODO: the sale date is the voucher's `_creationTime`. Vouchers imported
 * from Postgres (scripts/import-postgres-to-convex) got the import time
 * instead of their original purchase date, so they all land in the import
 * month. Re-import saving the legacy `created_at` in a new `purchasedAt`
 * column on `vouchers` (set to `_creationTime` for new checkouts), index it,
 * and read that here instead of `by_creation_time`.
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
    const currentStartMs = startOfSaoPauloDayMs(from);

    const inWindow = await ctx.db
      .query("vouchers")
      .withIndex("by_creation_time", (q) =>
        q
          .gte("_creationTime", startOfSaoPauloDayMs(previousFrom))
          .lte("_creationTime", endOfSaoPauloDayMs(to)),
      )
      .collect();

    const granularity = granularityFor(days);
    const buckets = emptyBuckets(from, to, granularity);
    const referrers = new Map<string, Share>();
    const paymentMethods = new Map<string, Share>();
    const paid: Doc<"vouchers">[] = [];
    let netCents = 0;
    let previousNetCents = 0;

    for (const voucher of inWindow) {
      if (!countsTowardRevenue(voucher)) continue;

      if (voucher._creationTime < currentStartMs) {
        previousNetCents += voucher.priceCents;
        continue;
      }

      paid.push(voucher);
      netCents += voucher.priceCents;

      const bucket =
        granularity === "hour"
          ? buckets[Math.floor((voucher._creationTime - currentStartMs) / HOUR_MS)]
          : findBucket(buckets, saoPauloDateKeyFast(voucher._creationTime));
      if (bucket) {
        bucket.netCents += voucher.priceCents;
        bucket.voucherCount += 1;
      }

      addShare(referrers, voucher.referrer?.source ?? "", voucher.priceCents);
      addShare(paymentMethods, paymentMethodKey(voucher), voucher.priceCents);
    }

    return {
      from,
      to,
      previousFrom,
      previousTo,
      granularity,
      netCents,
      previousNetCents,
      voucherCount: paid.length,
      buckets: granularity === "hour" ? trimHours(buckets) : buckets,
      referrers: sortedShares(referrers),
      paymentMethods: sortedShares(paymentMethods),
      recent: paid
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, RECENT_LIMIT)
        .map((voucher) => ({
          code: voucher.code,
          name: voucher.name,
          createdAt: voucher._creationTime,
          priceCents: voucher.priceCents,
          status: voucher.status,
        })),
    };
  },
});
