import { z } from "zod";

export const VOUCHER_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
export const LEGACY_VOUCHER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const VOUCHERS_KEY = "vouchers";
export const REMOVED_VOUCHERS_KEY = "removed_vouchers";

export const savedVoucherSchema = z.object({
  code: z.string().min(1),
  initPoint: z.string().refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }),
  createdAt: z.number().finite().nonnegative(),
  managementToken: z.string().optional(),
  lastFinancialEventAt: z.number().finite().nonnegative().optional(),
  hasPendingRefund: z.boolean().optional(),
  schemaVersion: z.number().int().optional(),
});
export type SavedVoucher = z.infer<typeof savedVoucherSchema>;
export type VoucherStorage = Pick<Storage, "getItem" | "setItem">;

export function isVoucherRetained(
  entry: SavedVoucher,
  now = Date.now(),
): boolean {
  // A voucher with an incomplete refund never expires automatically.
  if (entry.hasPendingRefund) {
    return true;
  }
  const effectiveTime = Math.max(
    entry.createdAt,
    entry.lastFinancialEventAt ?? 0,
  );
  return now - effectiveTime <= VOUCHER_RETENTION_MS;
}

export function canRemoveVoucher(voucher: SavedVoucher): boolean {
  // A voucher with an open or failed refund cannot be removed through the interface.
  return !voucher.hasPendingRefund;
}

export function isVoucherRemoved(
  storage: VoucherStorage,
  code: string,
): boolean {
  try {
    const raw = storage.getItem(REMOVED_VOUCHERS_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes(code);
  } catch {
    return false;
  }
}

export function markVoucherRemoved(
  storage: VoucherStorage,
  code: string,
): void {
  try {
    const raw = storage.getItem(REMOVED_VOUCHERS_KEY);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw ?? "[]");
    } catch {
      parsed = [];
    }
    const set = new Set<string>(Array.isArray(parsed) ? parsed : []);
    set.add(code);
    storage.setItem(REMOVED_VOUCHERS_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function readVouchers(
  storage: VoucherStorage,
  now = Date.now(),
  options?: { retainExpiredCandidates?: boolean },
): SavedVoucher[] {
  const raw = storage.getItem(VOUCHERS_KEY);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    parsed = [];
  }
  const entries: unknown[] = Array.isArray(parsed) ? parsed : [];
  const vouchers = new Map<string, SavedVoucher>();

  for (const entry of entries) {
    const result = savedVoucherSchema.safeParse(entry);
    if (!result.success) continue;

    let data = result.data;

    // Check if code was marked as removed
    if (isVoucherRemoved(storage, data.code)) {
      continue;
    }

    // Migrate entries stored under old rules rather than dropping them
    if (data.schemaVersion === undefined) {
      if (now - data.createdAt <= LEGACY_VOUCHER_RETENTION_MS) {
        data = {
          ...data,
          schemaVersion: 2,
          lastFinancialEventAt:
            now - data.createdAt > VOUCHER_RETENTION_MS
              ? now
              : data.lastFinancialEventAt,
        };
      } else {
        // Expired even under old 90-day rules
        continue;
      }
    }

    if (
      isVoucherRetained(data, now) ||
      (options?.retainExpiredCandidates && data.managementToken)
    ) {
      vouchers.set(data.code, data);
    }
  }

  const result = [...vouchers.values()];
  if (
    !options?.retainExpiredCandidates &&
    raw !== null &&
    raw !== JSON.stringify(result)
  ) {
    storage.setItem(VOUCHERS_KEY, JSON.stringify(result));
  }
  return result;
}

/** Re-read before each write so another tab's purchases are preserved. */
export function saveVoucher(
  storage: VoucherStorage,
  voucher: SavedVoucher,
  now = Date.now(),
): SavedVoucher[] {
  const entries = readVouchers(storage, now);
  const validated = savedVoucherSchema.parse({
    schemaVersion: 2,
    ...voucher,
  });

  if (isVoucherRemoved(storage, validated.code)) {
    return entries;
  }

  const existingIndex = entries.findIndex(
    (entry) => entry.code === validated.code,
  );

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    if (existing) {
      const merged: SavedVoucher = {
        ...existing,
        ...validated,
        createdAt: existing.createdAt,
        managementToken: validated.managementToken ?? existing.managementToken,
        lastFinancialEventAt:
          Math.max(
            existing.lastFinancialEventAt ?? 0,
            validated.lastFinancialEventAt ?? 0,
          ) || undefined,
        hasPendingRefund:
          validated.hasPendingRefund ?? existing.hasPendingRefund,
        schemaVersion: 2,
      };
      if (isVoucherRetained(merged, now)) {
        entries[existingIndex] = merged;
      } else {
        entries.splice(existingIndex, 1);
      }
    }
  } else if (isVoucherRetained(validated, now)) {
    entries.push(validated);
  }

  storage.setItem(VOUCHERS_KEY, JSON.stringify(entries));
  return entries;
}

export function removeVoucher(
  storage: VoucherStorage,
  code: string,
): SavedVoucher[] {
  const entries = readVouchers(storage);
  const target = entries.find((entry) => entry.code === code);
  if (target && !canRemoveVoucher(target)) {
    return entries;
  }
  const remaining = entries.filter((entry) => entry.code !== code);
  storage.setItem(VOUCHERS_KEY, JSON.stringify(remaining));
  markVoucherRemoved(storage, code);
  return remaining;
}

export function touchFinancialEvent(
  storage: VoucherStorage,
  code: string,
  options?: {
    eventAt?: number;
    hasPendingRefund?: boolean;
  },
  now = Date.now(),
): SavedVoucher[] {
  const entries = readVouchers(storage, now, {
    retainExpiredCandidates: true,
  });
  const target = entries.find((entry) => entry.code === code);
  if (!target) {
    return entries;
  }

  if (options?.eventAt !== undefined) {
    target.lastFinancialEventAt = Math.max(
      target.lastFinancialEventAt ?? 0,
      options.eventAt,
    );
  } else {
    target.lastFinancialEventAt = Math.max(
      target.lastFinancialEventAt ?? 0,
      now,
    );
  }

  if (options?.hasPendingRefund !== undefined) {
    target.hasPendingRefund = options.hasPendingRefund;
  }

  target.schemaVersion = 2;

  const retained = entries.filter((e) => isVoucherRetained(e, now));
  storage.setItem(VOUCHERS_KEY, JSON.stringify(retained));
  return retained;
}
