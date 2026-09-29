/**
 * Pure transformations from the legacy Postgres/Prisma shapes to the
 * Convex shapes (see convex/schema.ts). No I/O here on purpose, so every
 * rule below is unit-testable without a database — see transform.test.ts.
 */
import type { Referrer, Voucher } from "@prisma/client";

import {
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
} from "../../src/lib/utils/date.ts";

// --- Vouchers ---

export type VoucherStatus = "pending" | "valid" | "redeemed" | "expired";

/**
 * The legacy `status` column used the value `"used"` for what the new
 * schema calls `"redeemed"`; every other legacy value is already a member
 * of the new union. `"used"` must never reach the validator, so an
 * unrecognised value throws rather than passing something invalid through.
 */
export function normalizeVoucherStatus(status: string): VoucherStatus {
  if (status === "used") {
    return "redeemed";
  }
  if (
    status === "pending" ||
    status === "valid" ||
    status === "redeemed" ||
    status === "expired"
  ) {
    return status;
  }
  throw new Error(
    `Unrecognised legacy voucher status "${status}": add a mapping before importing.`,
  );
}

/**
 * Reais to integer cents, exact despite floating-point storage: Prisma's
 * `Float price` can carry values like 19.99 that don't round-trip through
 * `* 100` exactly (e.g. 19.99 * 100 === 1998.9999999999998), so the
 * multiplication result is rounded to the nearest integer rather than
 * truncated.
 */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Splits the legacy single `expires_at` column into `visitDate` and
 * `expiresAt`.
 *
 * Splitting rule: `expires_at` marks the exact instant a voucher stops
 * being redeemable. `visitDate` is the Sao Paulo calendar day that instant
 * falls at the end of, i.e. the calendar day one millisecond before
 * `expires_at`. `expiresAt` is then recomputed from that `visitDate` with
 * the same `endOfSaoPauloDayMs` helper the live app uses for
 * `insertPendingVoucher`/`reactivate` (convex/vouchers.ts), rather than
 * copied verbatim from the legacy column: on most rows this reproduces
 * `expires_at` exactly (legacy expiry was already stored as Sao Paulo local
 * midnight, i.e. exactly one millisecond after `endOfSaoPauloDayMs`'s
 * result), and on the handful of very old rows predating the visit-date
 * feature (where `expires_at` was simply `createdAt` plus a fixed window)
 * it derives a consistent, defensible `visitDate` from whatever calendar
 * day the row happened to expire on — there is no truer answer to recover
 * for those rows, since they were written before "visit date" existed as a
 * concept.
 */
export function splitExpiresAt(expiresAt: Date): {
  visitDate: string;
  expiresAtMs: number;
} {
  const visitDate = getSaoPauloDateKey(new Date(expiresAt.getTime() - 1));
  return { visitDate, expiresAtMs: endOfSaoPauloDayMs(visitDate) };
}

/**
 * Folds a legacy `Referrer` row (1:1 with a Voucher via `voucherCode`) into
 * the embedded `referrer` object the new schema carries directly on the
 * voucher. A voucher with no matching Referrer row stays valid with
 * `referrer` simply absent.
 */
export function foldReferrer(
  referrer: Pick<Referrer, "referrer" | "url"> | null | undefined,
): { source: string; url: string } | undefined {
  if (!referrer) {
    return undefined;
  }
  return { source: referrer.referrer, url: referrer.url };
}

export interface VoucherImportRow {
  code: string;
  name: string;
  phone: string;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  priceCents: number;
  status: VoucherStatus;
  visitDate: string;
  expiresAt: number;
  preferenceId: string;
  paymentId?: string;
  referrer?: { source: string; url: string };
  purchasedAt: number;
  deletedAt?: number;
}

/**
 * Builds the full Convex import row for one legacy Voucher, applying every
 * transformation this migration requires: status normalisation, cents,
 * the visitDate/expiresAt split, the folded referrer, and `purchasedAt` from
 * the legacy `createdAt`.
 *
 * A voucher with no `expires_at` uses its `createdAt` day as `visitDate`
 * (and that day's end as `expiresAt`); `usedCreatedAtFallback` flags those
 * rows so callers can report them.
 */
export function buildVoucherImportRow(
  voucher: Voucher,
  referrer: Pick<Referrer, "referrer" | "url"> | null | undefined,
): { row: VoucherImportRow; usedCreatedAtFallback: boolean } {
  const usedCreatedAtFallback = !voucher.expires_at;
  const visitDate = voucher.expires_at
    ? splitExpiresAt(voucher.expires_at).visitDate
    : getSaoPauloDateKey(voucher.createdAt);
  const expiresAtMs = endOfSaoPauloDayMs(visitDate);

  const row: VoucherImportRow = {
    code: voucher.code,
    name: voucher.name,
    phone: voucher.phone,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adults_pool,
    elderlyPool: voucher.elderly_pool,
    priceCents: reaisToCents(voucher.price),
    status: normalizeVoucherStatus(voucher.status),
    visitDate,
    expiresAt: expiresAtMs,
    preferenceId: voucher.preference_id,
    paymentId: voucher.payment_id ?? undefined,
    referrer: foldReferrer(referrer),
    purchasedAt: voucher.createdAt.getTime(),
    deletedAt: voucher.deletedAt?.getTime(),
  };
  return { row, usedCreatedAtFallback };
}
