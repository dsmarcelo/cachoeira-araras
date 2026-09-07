import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "../_generated/api";

/**
 * Checkout throttling thresholds (audit issue 10). Kept in one place so the
 * limit values are easy to find and tune, and so `startCheckout` never
 * hand-rolls a database counter (which would race under concurrency).
 *
 * - `checkoutByPhone`: a customer phone number may attempt checkout at most
 *   3 times per 10 minutes (token bucket, capacity 3 — allows a short burst
 *   for a mistyped field, then throttles).
 * - `checkoutGlobal`: a much looser system-wide ceiling — 60 checkout
 *   attempts per minute across all phone numbers — to protect Mercado Pago
 *   preference-creation capacity from a coordinated burst.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
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
export const MAX_PENDING_VOUCHERS_PER_PHONE = 2;

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
