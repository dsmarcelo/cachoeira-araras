/**
 * Lowercases and strips accents so the admin search matches "José" with
 * "jose". Used on both sides of the search: when writing `searchText` and
 * when reading the admin's query.
 */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The value stored in `vouchers.searchText`, which feeds the `search_text`
 * search index. Must be recomputed by any write that changes code, name or
 * phone.
 */
export function voucherSearchText(voucher: {
  code: string;
  name: string;
  phone: string;
}): string {
  return normalizeSearch(`${voucher.code} ${voucher.name} ${voucher.phone}`);
}
