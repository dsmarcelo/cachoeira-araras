/**
 * Pure transformations from the legacy Postgres/Prisma shapes to the
 * Convex shapes (see convex/schema.ts). No I/O here on purpose, so every
 * rule below is unit-testable without a database — see transform.test.ts.
 */
import type { Referrer, SiteSetting, Voucher } from "@prisma/client";

import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type SettingKey,
  type SettingValueMap,
} from "../../convex/lib/settings.ts";
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
  deletedAt?: number;
}

/**
 * Builds the full Convex import row for one legacy Voucher, applying every
 * transformation this migration requires: status normalisation, cents,
 * the visitDate/expiresAt split, and the folded referrer.
 */
export function buildVoucherImportRow(
  voucher: Voucher,
  referrer: Pick<Referrer, "referrer" | "url"> | null | undefined,
): VoucherImportRow {
  if (!voucher.expires_at) {
    throw new Error(
      `Voucher ${voucher.code} has no expires_at; cannot derive visitDate/expiresAt.`,
    );
  }

  const { visitDate, expiresAtMs } = splitExpiresAt(voucher.expires_at);

  return {
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
    deletedAt: voucher.deletedAt?.getTime(),
  };
}

// --- Site Settings ---

/** The shape a setting's declared value takes, derived from `DEFAULT_SETTINGS`. */
type SettingValueKind = "number" | "string" | "boolean" | "string[]";

function declaredKind(key: SettingKey): SettingValueKind {
  const value = DEFAULT_SETTINGS[key];
  if (Array.isArray(value)) {
    return "string[]";
  }
  return typeof value as "number" | "string" | "boolean";
}

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Thrown for a legacy Site Setting row this migration refuses to guess about. */
export class SettingImportError extends Error {
  readonly key: string;

  constructor(key: string, message: string) {
    super(message);
    this.key = key;
    this.name = "SettingImportError";
  }
}

export interface SettingImportRow {
  key: SettingKey;
  value: SettingValueMap[SettingKey];
  updatedBy?: string;
  updatedAt?: number;
}

/**
 * Prices are the only settings the legacy EAV table stored in reais; every
 * other numeric setting (quantity limits, the booking window) is a plain
 * count and needs no conversion.
 */
const PRICE_SETTING_KEYS: readonly SettingKey[] = [
  "voucher.price",
  "voucher.pool.price",
];

/**
 * Converts one legacy `SiteSetting` EAV row into its typed Convex shape.
 *
 * The declared type comes from `DEFAULT_SETTINGS` (the settings
 * vocabulary's compile-time source of truth), never from the legacy
 * `type` column: the value is read from whichever of the four legacy value
 * columns matches that declared type. An unknown key, or a declared-type
 * column that is null/mismatched, throws a `SettingImportError` rather than
 * silently substituting a default — this migration must never guess at a
 * setting's real value.
 */
export function buildSettingImportRow(row: SiteSetting): SettingImportRow {
  if (!isSettingKey(row.key)) {
    throw new SettingImportError(
      row.key,
      `Unknown Site Setting key "${row.key}": not in the settings vocabulary (convex/lib/settings.ts). Resolve or explicitly exclude it before importing.`,
    );
  }

  const kind = declaredKind(row.key);
  const value = selectTypedValue(row, kind);

  const converted =
    kind === "number" && PRICE_SETTING_KEYS.includes(row.key)
      ? reaisToCents(value as number)
      : value;

  return {
    key: row.key,
    value: converted,
    updatedBy: row.updatedBy ?? undefined,
    updatedAt: row.updatedAt.getTime(),
  };
}

function selectTypedValue(
  row: SiteSetting,
  kind: SettingValueKind,
): number | string | boolean | string[] {
  switch (kind) {
    case "number":
      if (row.numberValue === null) {
        throw new SettingImportError(
          row.key,
          `Site Setting "${row.key}" is declared "number" but numberValue is null.`,
        );
      }
      return row.numberValue;
    case "string":
      if (row.stringValue === null) {
        throw new SettingImportError(
          row.key,
          `Site Setting "${row.key}" is declared "string" but stringValue is null.`,
        );
      }
      return row.stringValue;
    case "boolean":
      if (row.boolValue === null) {
        throw new SettingImportError(
          row.key,
          `Site Setting "${row.key}" is declared "boolean" but boolValue is null.`,
        );
      }
      return row.boolValue;
    case "string[]":
      if (!isStringArray(row.jsonValue)) {
        throw new SettingImportError(
          row.key,
          `Site Setting "${row.key}" is declared "string[]" but jsonValue is ${JSON.stringify(row.jsonValue)}.`,
        );
      }
      return row.jsonValue;
  }
}
