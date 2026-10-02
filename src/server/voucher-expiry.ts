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

/**
 * Converts a "YYYY-MM-DD" visit day into 00:00 Brasília, the same instant
 * stored at purchase. Returns null for malformed or non-existent days (31/02).
 */
export function brazilDateKeyToDate(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const localMidnightUtc = Date.parse(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(localMidnightUtc)) return null;
  // Date.parse rolls 02-31 over to March, so the round trip rejects it.
  if (new Date(localMidnightUtc).toISOString().slice(0, 10) !== dateKey) return null;
  return new Date(localMidnightUtc + UTC_OFFSET_HOURS * 3_600_000);
}
