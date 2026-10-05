/** Voucher Codes are 4 to 6 characters of `a-z0-9` (see ADR 0007). */
export const VOUCHER_CODE_MIN_LENGTH = 4;
export const VOUCHER_CODE_MAX_LENGTH = 6;

/** Normalizes typed input into a Voucher Code candidate: lowercase `a-z0-9`, at most 6 characters. */
export function sanitizeVoucherCode(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, VOUCHER_CODE_MAX_LENGTH);
}
