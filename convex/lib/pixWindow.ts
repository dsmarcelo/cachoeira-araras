import {
  getSaoPauloDateKey,
  startOfSaoPauloDayMs,
} from "../../src/lib/utils/date";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A Pix charge is payable for 30 minutes after it is created. */
export const PIX_TTL_MS = 30 * MINUTE;
// Mercado Pago rejects a `date_of_expiration` less than 30 minutes from its own
// clock, so the deadline we send leaves room for request latency.
const PIX_PROVIDER_MARGIN_MS = 10_000;

/** Same-day visits: no new Pix from this time on (America/Sao_Paulo). */
const SAME_DAY_PIX_CUTOFF_MS = 16 * HOUR + 30 * MINUTE;
/** Same-day visits: a Pix never stays payable past this time. */
const SAME_DAY_PIX_DEADLINE_MS = 17 * HOUR;

/**
 * When a same-day Pix stops being creatable, or null when the visit is on
 * another day and the regular purchase rules are all that apply.
 */
export function sameDayPixCutoffMs(visitDate: string, now: number) {
  return getSaoPauloDateKey(new Date(now)) === visitDate
    ? startOfSaoPauloDayMs(visitDate) + SAME_DAY_PIX_CUTOFF_MS
    : null;
}

/**
 * Decides whether a Pix may be created now for `visitDate` and when it must
 * expire. The deadline belongs to the charge only; it never touches the
 * Voucher's Visit Date or Expiry.
 */
export function planPix(visitDate: string, now: number) {
  const cutoff = sameDayPixCutoffMs(visitDate, now);
  if (cutoff !== null && now >= cutoff) return { allowed: false as const };
  const expiresAt = now + PIX_TTL_MS + PIX_PROVIDER_MARGIN_MS;
  return {
    allowed: true as const,
    expiresAt:
      cutoff === null
        ? expiresAt
        : Math.min(
            expiresAt,
            startOfSaoPauloDayMs(visitDate) + SAME_DAY_PIX_DEADLINE_MS,
          ),
  };
}

/** Same-day visits: no new card charge from this time on (America/Sao_Paulo). */
const SAME_DAY_CARD_CUTOFF_MS = 17 * HOUR;

/** When a same-day card charge stops being creatable, or null for other days. */
export function sameDayCardCutoffMs(visitDate: string, now: number) {
  return getSaoPauloDateKey(new Date(now)) === visitDate
    ? startOfSaoPauloDayMs(visitDate) + SAME_DAY_CARD_CUTOFF_MS
    : null;
}
