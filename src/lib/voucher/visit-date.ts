import { addDaysToDateKey } from "../utils/date";

/**
 * Booking restrictions that apply to customers (purchase and customer
 * reschedule). Omitted for admins, who may pick any day from today on.
 */
export interface VisitDateBookingRules {
  maxIntendedDays: number;
  disabledDays: readonly string[];
}

/**
 * The single Visit Date rule shared by purchase validation, the purchase and
 * reschedule calendars, and reschedule mutations. Returns a readable reason
 * when `dateKey` ("YYYY-MM-DD", Sao Paulo calendar) cannot be booked, or null
 * when it can. Without `rules` only the "not in the past" check applies.
 * Dates are compared as strings so a visitor's local timezone never shifts
 * the day being checked.
 */
export function getVisitDateRejection(
  dateKey: string,
  options: { todayKey: string; rules?: VisitDateBookingRules },
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return "Data de visita inválida.";
  }

  if (dateKey < options.todayKey) {
    return "Data de visita não pode estar no passado.";
  }

  const { rules } = options;
  if (!rules) {
    return null;
  }

  if (dateKey > addDaysToDateKey(options.todayKey, rules.maxIntendedDays)) {
    return "Data de visita além do limite permitido.";
  }

  if (rules.disabledDays.includes(dateKey)) {
    return "Data de visita indisponível.";
  }

  return null;
}
