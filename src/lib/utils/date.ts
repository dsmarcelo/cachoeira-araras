export function getBrazilianDate(date?: Date) {
  const d = date ?? new Date();
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/**
 * The operational day (year-month-day) in the Sao Paulo timezone, as a
 * "YYYY-MM-DD" key. This is the single place that answers "what day is it in
 * Sao Paulo" and every caller needing that answer should go through here
 * instead of reimplementing the timezone conversion inline.
 */
export function getSaoPauloDateKey(date?: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(date ?? new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Sao Paulo date key");
  }

  return `${year}-${month}-${day}`;
}

/**
 * The start of a Sao Paulo calendar day (given as a "YYYY-MM-DD" key, see
 * `getSaoPauloDateKey`), in epoch ms. Sao Paulo has used a fixed UTC-3 offset
 * since Brazil abolished daylight saving in 2019, so this is a plain
 * fixed-offset conversion rather than a timezone-table lookup.
 */
export function startOfSaoPauloDayMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, day, 3, 0, 0, 0);
}

/**
 * The last millisecond of a Sao Paulo calendar day (given as a "YYYY-MM-DD"
 * key): a voucher stops being redeemable at the end of the day the customer
 * chose. See `startOfSaoPauloDayMs` for the fixed UTC-3 offset assumption.
 */
export function endOfSaoPauloDayMs(dateKey: string): number {
  return startOfSaoPauloDayMs(dateKey) + 24 * 60 * 60 * 1000 - 1;
}

export function isSameDay(date1: Date, date2: Date) {
  const d1 = getBrazilianDate(date1);
  const d2 = getBrazilianDate(date2);

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
