/**
 * In-memory Voucher Code -> management token for this tab's lifetime. The
 * durable copy lives in browser storage; this one only keeps the embedded
 * payment page working right after a purchase when storage is unavailable
 * (private mode, blocked or full). It is lost on reload, by design.
 */
const cache = new Map<string, string>();

export function getCachedManagementToken(code: string): string | undefined {
  return cache.get(code);
}

export function setCachedManagementToken(
  code: string,
  managementToken: string,
): void {
  cache.set(code, managementToken);
}
