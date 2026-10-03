import { addDaysToDateKey, getSaoPauloDateKey, startOfSaoPauloDayMs } from "./utils/date";

// Report periods are inclusive ranges of Sao Paulo calendar days as
// "YYYY-MM-DD" keys. Shared by the admin Financeiro page and
// `convex/finance.ts`, so both refuse the same ranges.

/** Longest range the report accepts; the report also reads the previous period of the same length. */
export const MAX_REPORT_DAYS = 366;

export type Period = { from: string; to: string };

export const PERIOD_PRESETS = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
  mesPassado: "Mês passado",
  ano: "Este ano",
} as const;
export type PeriodPreset = keyof typeof PERIOD_PRESETS;

export function isPeriodPreset(value: string | null): value is PeriodPreset {
  return value !== null && Object.hasOwn(PERIOD_PRESETS, value);
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && addDaysToDateKey(key, 0) === key;
}

/** Number of calendar days in the inclusive range. */
export function daysInPeriod({ from, to }: Period): number {
  return Math.round((startOfSaoPauloDayMs(to) - startOfSaoPauloDayMs(from)) / 86_400_000) + 1;
}

/** A readable pt-BR reason the period can't be reported on, or null when it's fine. */
export function periodError(period: Period): string | null {
  if (!isValidDateKey(period.from) || !isValidDateKey(period.to)) {
    return "Datas inválidas. Escolha o período novamente.";
  }
  if (period.from > period.to) {
    return "A data inicial precisa ser anterior à data final.";
  }
  if (daysInPeriod(period) > MAX_REPORT_DAYS) {
    return `Escolha um período de até ${MAX_REPORT_DAYS} dias.`;
  }
  return null;
}

/** The concrete range a preset means today (Sao Paulo); "this month/year" run up to today. */
export function presetPeriod(preset: PeriodPreset, today = getSaoPauloDateKey()): Period {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "hoje":
      return { from: today, to: today };
    case "ontem": {
      const yesterday = addDaysToDateKey(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "7d":
      return { from: addDaysToDateKey(today, -6), to: today };
    case "30d":
      return { from: addDaysToDateKey(today, -29), to: today };
    case "mes":
      return { from: monthStart, to: today };
    case "mesPassado": {
      const lastMonthEnd = addDaysToDateKey(monthStart, -1);
      return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd };
    }
    case "ano":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}
