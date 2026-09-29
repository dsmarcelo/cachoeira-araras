import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Period } from "@/lib/finance-period";
import { formatToBRL } from "@/lib/utils";
import type { api } from "../../../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type FinancialReport = FunctionReturnType<typeof api.finance.financialReport>;
export type ReportBucket = FinancialReport["buckets"][number];

/** Local `Date` at midnight for a "YYYY-MM-DD" key; for display and the calendar only. */
export function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

export function dateToKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatCents(cents: number): string {
  return formatToBRL(cents / 100);
}

const fmt = (key: string, pattern: string) => format(keyToDate(key), pattern, { locale: ptBR });

/** "28 set 2026", "22 – 28 set 2026", "28 ago – 3 set 2026". */
export function formatPeriod({ from, to }: Period): string {
  if (from === to) return fmt(from, "d MMM yyyy");
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(0, 7) === to.slice(0, 7);
  const start = fmt(from, sameMonth ? "d" : sameYear ? "d MMM" : "d MMM yyyy");
  return `${start} – ${fmt(to, "d MMM yyyy")}`;
}

/** Short axis label for a chart bucket. */
export function bucketLabel(
  bucket: ReportBucket,
  granularity: FinancialReport["granularity"],
  bucketCount: number,
): string {
  switch (granularity) {
    case "hour":
      return `${bucket.hour}h`;
    case "month":
      return fmt(bucket.from, "MMM");
    case "day":
      // ptBR's "EEE" is the full weekday ("quarta"); three letters fit a phone.
      return bucketCount <= 7 ? fmt(bucket.from, "EEEE").slice(0, 3) : fmt(bucket.from, "d/MM");
    case "week":
      return fmt(bucket.from, "d/MM");
  }
}

/** Full description of a chart bucket, for the readout and screen readers. */
export function bucketTitle(
  bucket: ReportBucket,
  granularity: FinancialReport["granularity"],
): string {
  switch (granularity) {
    case "hour":
      return `${bucket.hour}h – ${(bucket.hour ?? 0) + 1}h`;
    case "day":
      return fmt(bucket.from, "EEEE, d 'de' MMMM");
    case "week":
      return formatPeriod(bucket);
    case "month":
      return fmt(bucket.from, "MMMM 'de' yyyy");
  }
}

// Keys come from `paymentMethodKey` in convex/finance.ts: Mercado Pago
// `payment_type_id` values, plus "pix" split out of "bank_transfer".
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  prepaid_card: "Cartão pré-pago",
  account_money: "Saldo Mercado Pago",
  bank_transfer: "Transferência",
  ticket: "Boleto",
  atm: "Caixa eletrônico",
};

export function paymentMethodLabel(key: string): string {
  if (key === "") return "Não registrada";
  return PAYMENT_METHOD_LABELS[key] ?? key;
}

export function referrerLabel(source: string): string {
  return source === "" ? "Direto / outros" : source;
}
