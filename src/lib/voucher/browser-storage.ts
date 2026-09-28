import { z } from "zod";

/** Every voucher stays in the browser history for two years; customers cannot remove it. */
export const VOUCHER_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;
export const VOUCHERS_KEY = "vouchers";

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

    // Entries stored before schema versioning fall under the same retention.
    const data = { ...result.data, schemaVersion: 2 };

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
