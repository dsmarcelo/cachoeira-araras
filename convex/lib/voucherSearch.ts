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

/** A phone number's digits without the Brazilian "55" country code. */
function nationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/**
 * The phone as the search index sees it. Full-text search only matches word
 * prefixes, so besides the full number we store it without the area code
 * ("984524847") and without the leading mobile 9 ("84524847"): staff can
 * then find a voucher by typing the number the way the customer says it.
 */
function phoneSearchTokens(phone: string): string[] {
  const national = nationalDigits(phone);
  const tokens = [national];
  if (national.length >= 10) {
    const local = national.slice(2);
    tokens.push(local);
    if (local.length === 9 && local.startsWith("9")) tokens.push(local.slice(1));
  }
  return [...new Set(tokens.filter(Boolean))];
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
  return normalizeSearch(
    [voucher.code, voucher.name, ...phoneSearchTokens(voucher.phone)].join(" "),
  );
}

/**
 * Normalizes the admin's search box. A query that looks like a phone number
 * ("(62) 98452-4847", "+55 62 98452") collapses to its national digits so it
 * lines up with the tokens `voucherSearchText` stores.
 */
export function normalizeSearchQuery(input: string): string {
  const normalized = normalizeSearch(input);
  if (/^[\d\s()+\-.]+$/.test(normalized) && /\d/.test(normalized)) {
    return nationalDigits(normalized);
  }
  return normalized;
}
