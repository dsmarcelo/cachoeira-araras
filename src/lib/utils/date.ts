export function getBrazilianDate(date?: Date) {
  const d = date ?? new Date();
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
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
