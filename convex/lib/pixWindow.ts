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
// Shortest Pix life that still meets the provider minimum.
const PIX_MIN_LIFE_MS = PIX_TTL_MS + PIX_PROVIDER_MARGIN_MS;

/** Same-day visits: a Pix never stays payable past this time (America/Sao_Paulo). */
const SAME_DAY_PIX_DEADLINE_MS = 17 * HOUR;
/**
 * Same-day visits: no new Pix from this time on. Placed so that a Pix created
 * right before it still lives long enough for the provider minimum at the
 * deadline, i.e. the deadline never shortens a Pix below `PIX_MIN_LIFE_MS`.
 */
const SAME_DAY_PIX_CUTOFF_MS = SAME_DAY_PIX_DEADLINE_MS - PIX_MIN_LIFE_MS;
/** Same-day visits: no new card charge from this time on. */
const SAME_DAY_CARD_CUTOFF_MS = 17 * HOUR;

function formatClock(msOfDay: number) {
  const hours = Math.floor(msOfDay / HOUR);
  const minutes = Math.round((msOfDay % HOUR) / MINUTE);
  return minutes === 0
    ? `${hours}h`
    : `${hours}h${String(minutes).padStart(2, "0")}`;
}

/**
 * Buyer-facing times, derived from the rules above. The Pix time is the
 * deadline minus the 30 minute life ("16h30"); the provider margin is only
 * seconds and stays out of the wording.
 */
export const sameDayPixLabel = formatClock(
  SAME_DAY_PIX_DEADLINE_MS - PIX_TTL_MS,
);
export const sameDayCardLabel = formatClock(SAME_DAY_CARD_CUTOFF_MS);

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
 * expire: always `PIX_MIN_LIFE_MS` after creation. The same-day cutoff already
 * guarantees that instant is never past the 17h deadline. The deadline belongs
 * to the charge only; it never touches the Voucher's Visit Date or Expiry.
 */
export function planPix(visitDate: string, now: number) {
  const cutoff = sameDayPixCutoffMs(visitDate, now);
  if (cutoff !== null && now >= cutoff) return { allowed: false as const };
  return { allowed: true as const, expiresAt: now + PIX_MIN_LIFE_MS };
}

/** When a same-day card charge stops being creatable, or null for other days. */
export function sameDayCardCutoffMs(visitDate: string, now: number) {
  return getSaoPauloDateKey(new Date(now)) === visitDate
    ? startOfSaoPauloDayMs(visitDate) + SAME_DAY_CARD_CUTOFF_MS
    : null;
}
