import { z } from "zod";

export const VOUCHER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const VOUCHERS_KEY = "vouchers";

const savedVoucherSchema = z.object({
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
});
export type SavedVoucher = z.infer<typeof savedVoucherSchema>;
type VoucherStorage = Pick<Storage, "getItem" | "setItem">;

export function readVouchers(storage: VoucherStorage, now = Date.now()) {
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
    if (result.success && now - result.data.createdAt <= VOUCHER_RETENTION_MS) {
      vouchers.set(result.data.code, result.data);
    }
  }
  const result = [...vouchers.values()];
  if (raw !== null && raw !== JSON.stringify(result)) {
    storage.setItem(VOUCHERS_KEY, JSON.stringify(result));
  }
  return result;
}

/** Re-read before each write so another tab's purchases are preserved. */
export function saveVoucher(
  storage: VoucherStorage,
  voucher: SavedVoucher,
  now = Date.now(),
) {
  const entries = readVouchers(storage, now);
  const validated = savedVoucherSchema.parse(voucher);
  if (
    now - validated.createdAt <= VOUCHER_RETENTION_MS &&
    !entries.some((entry) => entry.code === validated.code)
  ) {
    entries.push(validated);
  }
  storage.setItem(VOUCHERS_KEY, JSON.stringify(entries));
  return entries;
}

export function removeVoucher(storage: VoucherStorage, code: string) {
  const entries = readVouchers(storage).filter((entry) => entry.code !== code);
  storage.setItem(VOUCHERS_KEY, JSON.stringify(entries));
  return entries;
}
