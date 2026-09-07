/**
 * In-memory cache of Voucher Code -> lookupToken for this browser tab's
 * lifetime. `authorizeLookup` spends from the shared, rate-limited anonymous
 * lookup bucket on every call (see convex/vouchers.ts), even for a code this
 * same browser already authorized moments ago — e.g. the cookie-fallback
 * voucher `SavedVouchersProvider` migrates on mount is often the same code a
 * card on "Meus Vouchers" authorizes again right after. Components that may
 * independently authorize the same code share this cache instead of each
 * spending their own token for it.
 */
const cache = new Map<string, string>();

export function getCachedLookupToken(code: string): string | undefined {
  return cache.get(code);
}

export function setCachedLookupToken(code: string, lookupToken: string): void {
  cache.set(code, lookupToken);
}
