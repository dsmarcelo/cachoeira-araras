import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "../_generated/api";

/**
 * Public throttling thresholds. Kept in one place so the limit values are
 * easy to find and tune, and so callers never hand-roll database counters
 * (which would race under concurrency).
 *
 * - `voucherLookupGlobal`: all anonymous Voucher Code lookups share one
 *   unkeyed burst of 60 attempts per minute. Deliberately not keyed by a
 *   client-supplied id: an attacker can mint a fresh key for free, so a
 *   per-key limit alone would multiply the effective budget by however many
 *   fake keys they spin up. A single shared pool is the actual anti-sweep
 *   control (see `authorizeLookup` in convex/vouchers.ts) — 60/minute still
 *   makes sweeping the ~1.68M-code keyspace take roughly 19 days of sustained
 *   peak-rate traffic, loud enough to be caught long before it matters, while
 *   giving legitimate concurrent visitors (several payment returns and
 *   "Meus Vouchers" pages loading at once) enough headroom that they don't
 *   throttle each other. Successful authorization yields an opaque,
 *   voucher-scoped capability, so reactive status reads spend no more tokens.
 * - `checkoutByPhone`: a customer phone number may attempt checkout at most
 *   3 times per 10 minutes (token bucket, capacity 3 — allows a short burst
 *   for a mistyped field, then throttles).
 * - `checkoutGlobal`: a much looser system-wide ceiling — 60 checkout
 *   attempts per minute across all phone numbers — to protect Mercado Pago
 *   preference-creation capacity from a coordinated burst.
 */
export const VOUCHER_LOOKUP_BURST_LIMIT = 60;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  voucherLookupGlobal: {
    kind: "token bucket",
    rate: VOUCHER_LOOKUP_BURST_LIMIT,
    period: MINUTE,
    capacity: VOUCHER_LOOKUP_BURST_LIMIT,
  },
  checkoutByPhone: {
    kind: "token bucket",
    rate: 3,
    period: 10 * MINUTE,
    capacity: 3,
  },
  checkoutGlobal: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 60,
  },
});

/**
 * Ceiling on unexpired Pending Vouchers a single phone number may hold at
 * once. Distinct from the rate limits above: this blocks accumulating
 * abandoned preferences even when each individual attempt is well spaced
 * out in time (the failure mode the audit found: 56 abandoned Pending
 * Vouchers in the dev deployment).
 */
export const MAX_PENDING_VOUCHERS_PER_PHONE = 1;

/**
 * Renders a `retryAfter` duration (ms, from a rate limiter result) as a
 * short Portuguese phrase for user-facing error messages.
 */
export function formatRetryAfter(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds <= 60) {
    return "cerca de 1 minuto";
  }
  const minutes = Math.ceil(seconds / 60);
  return `cerca de ${minutes} minutos`;
}
