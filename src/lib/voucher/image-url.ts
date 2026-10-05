/**
 * URL of the server-rendered voucher PNG. `version` is any value that changes
 * when the image content changes (expiry, status), so browsers refetch it.
 * Customers pass their `lookupToken`; staff omit it and `/api/og` authorizes
 * them by session.
 */
export function voucherImageUrl(
  code: string,
  lookupToken: string | undefined,
  version: string | number,
): string {
  const token = lookupToken
    ? `&lookupToken=${encodeURIComponent(lookupToken)}`
    : "";
  return `/api/og?code=${encodeURIComponent(code)}${token}&v=${encodeURIComponent(version)}`;
}
