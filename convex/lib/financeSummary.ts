import { startOfSaoPauloDayMs } from "../../src/lib/utils/date";
import type { Doc } from "../_generated/dataModel";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Whether a voucher counts as a real, live voucher for operational and
 * reporting purposes: not soft-deleted, and not a Test Voucher. Every gate,
 * admin, and summary query must use this instead of re-typing the two
 * conditions.
 */
export function countsAsRealVoucher(
  voucher: Pick<Doc<"vouchers">, "deletedAt" | "isTest">,
): boolean {
  return voucher.deletedAt === undefined && !voucher.isTest;
}

/**
 * Whether a voucher's price counts as revenue: a real voucher (see
 * `countsAsRealVoucher`) whose payment Mercado Pago approved — `paymentId` is
 * written only together with that approval (`confirmPayment`), so a status an
 * admin set by hand without a payment never counts — and whose payment was
 * not later taken back (refund, chargeback, cancellation: status `refunded` or
 * a `reversal` on a redeemed voucher).
 */
export function countsTowardRevenue(voucher: Doc<"vouchers">): boolean {
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
export function paymentMethodKey(voucher: Doc<"vouchers">): string {
  if (voucher.paymentMethodId === "pix") return "pix";
  return voucher.paymentTypeId ?? "";
}

/** When the customer bought the voucher; falls back for rows not yet backfilled. */
export function voucherPurchaseMs(
  voucher: Pick<Doc<"vouchers">, "purchasedAt" | "_creationTime">,
): number {
  return voucher.purchasedAt ?? voucher._creationTime;
}

/**
 * Sao Paulo "YYYY-MM-DD" key for an instant, using the same fixed UTC-3
 * offset as `startOfSaoPauloDayMs`. Cheap enough to call per voucher, where
 * building an `Intl.DateTimeFormat` (`getSaoPauloDateKey`) is not.
 */
export function saoPauloDateKeyFast(ms: number): string {
  return new Date(ms - 3 * HOUR_MS).toISOString().slice(0, 10);
}

// Revenue attributed to one group (referrer source or payment method key).
export type Share = { netCents: number; voucherCount: number };
export type KeyedShare = Share & { key: string };

export function addShare(
  shares: Map<string, Share>,
  key: string,
  cents: number,
  count = 1,
) {
  const share = shares.get(key) ?? { netCents: 0, voucherCount: 0 };
  share.netCents += cents;
  share.voucherCount += count;
  shares.set(key, share);
}

export function sortedShares(shares: Map<string, Share>): KeyedShare[] {
  return Array.from(shares, ([key, share]) => ({ key, ...share })).sort(
    (a, b) => b.netCents - a.netCents,
  );
}

/** The shape of one `financeDays` document, minus `updatedAt`. */
export type DaySummary = {
  date: string;
  netCents: number;
  voucherCount: number;
  // Always 24 entries, indexed by Sao Paulo hour of day.
  hours: Share[];
  referrers: KeyedShare[];
  paymentMethods: KeyedShare[];
};

/**
 * Revenue summary of one Sao Paulo purchase day. `vouchers` are the vouchers
 * purchased that day; the ones that do not count toward revenue are ignored.
 */
export function summarizeDay(
  date: string,
  vouchers: Doc<"vouchers">[],
): DaySummary {
  const startMs = startOfSaoPauloDayMs(date);
  const hours: Share[] = Array.from({ length: 24 }, () => ({
    netCents: 0,
    voucherCount: 0,
  }));
  const referrers = new Map<string, Share>();
  const paymentMethods = new Map<string, Share>();
  let netCents = 0;
  let voucherCount = 0;

  for (const voucher of vouchers) {
    if (!countsTowardRevenue(voucher)) continue;
    netCents += voucher.priceCents;
    voucherCount += 1;

    const hour = Math.min(
      23,
      Math.max(0, Math.floor((voucherPurchaseMs(voucher) - startMs) / HOUR_MS)),
    );
    hours[hour]!.netCents += voucher.priceCents;
    hours[hour]!.voucherCount += 1;

    addShare(referrers, voucher.referrer?.source ?? "", voucher.priceCents);
    addShare(paymentMethods, paymentMethodKey(voucher), voucher.priceCents);
  }

  return {
    date,
    netCents,
    voucherCount,
    hours,
    referrers: sortedShares(referrers),
    paymentMethods: sortedShares(paymentMethods),
  };
}

/**
 * What a voucher adds to the finance summaries, or null when it adds nothing.
 * Two states with the same contribution need no recompute (e.g. valid ->
 * redeemed at the gate).
 */
export function revenueContribution(voucher: Doc<"vouchers">): string | null {
  if (!countsTowardRevenue(voucher)) return null;
  return JSON.stringify([
    saoPauloDateKeyFast(voucherPurchaseMs(voucher)),
    voucherPurchaseMs(voucher),
    voucher.priceCents,
    voucher.referrer?.source ?? "",
    paymentMethodKey(voucher),
  ]);
}
