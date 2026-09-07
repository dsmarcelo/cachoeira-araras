export function getBrazilianDate(date?: Date) {
  const d = date ?? new Date();
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/**
 * Returns the calendar day (YYYY-MM-DD) `date` falls on in the
 * America/Sao_Paulo timezone. Use this instead of `toISOString().slice(0, 10)`
 * or `getBrazilianDate`, both of which can shift the day for timezones
 * east of Greenwich when converting through UTC.
 */
export function getSaoPauloDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Adds `days` (can be negative) to a YYYY-MM-DD date key and returns the resulting key. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const [, year, month, day] = match;
  const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
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
