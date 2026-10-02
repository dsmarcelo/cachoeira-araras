import { isVoucherExpired } from "./voucher-expiry.ts";

type VisitDateUpdate =
  | { ok: true; data: { expires_at: Date; status?: "valid"; valid?: true } }
  | { ok: false; message: string };

/**
 * Decides what an admin changing a voucher's visit date writes to the database.
 * Redeemed vouchers are locked. An expired voucher moved to today or later is
 * reactivated; any other status is left alone (the maintenance cron expires
 * valid vouchers whose new date is already past).
 */
export function planVisitDateUpdate(
  voucher: { status: string },
  visitDate: Date,
  now: Date = new Date(),
): VisitDateUpdate {
  if (voucher.status === "redeemed") {
    return {
      ok: false,
      message: "Vouchers já utilizados não podem ter a data alterada.",
    };
  }
  if (voucher.status === "expired" && !isVoucherExpired(visitDate, now)) {
    return {
      ok: true,
      data: { expires_at: visitDate, status: "valid", valid: true },
    };
  }
  return { ok: true, data: { expires_at: visitDate } };
}
