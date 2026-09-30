const TIME_ZONE = "America/Sao_Paulo";
// Brazil has no DST since 2019, so local midnight is always 03:00 UTC.
const UTC_OFFSET_HOURS = 3;

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
  year: "numeric",
});

export function getBrazilDateKey(date: Date) {
  return dateKeyFormat.format(date);
}

/**
 * `expires_at` is the visit date, not an expiry instant: it may be stored at
 * 00:00 Brasília and stays usable through that whole local day. A voucher is
 * expired only once the current local date is after the visit date.
 */
export function isVoucherExpired(expiresAt: Date | null, now: Date) {
  if (!expiresAt) return false;
  return getBrazilDateKey(expiresAt) < getBrazilDateKey(now);
}

/** Instant at which the current Brasília day started; use with `lt` filters. */
export function startOfBrazilDay(now: Date) {
  const localMidnightUtc = Date.parse(`${getBrazilDateKey(now)}T00:00:00Z`);
  return new Date(localMidnightUtc + UTC_OFFSET_HOURS * 3_600_000);
}
