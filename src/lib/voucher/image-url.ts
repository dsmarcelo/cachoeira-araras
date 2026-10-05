/**
 * URL of the server-rendered voucher PNG. `version` is any value that changes
 * when the image content changes (expiry, status), so browsers refetch it.
 */
export function voucherImageUrl(
  code: string,
  lookupToken: string,
  version: string | number,
): string {
  return `/api/og?code=${encodeURIComponent(code)}&lookupToken=${encodeURIComponent(lookupToken)}&v=${encodeURIComponent(version)}`;
}
