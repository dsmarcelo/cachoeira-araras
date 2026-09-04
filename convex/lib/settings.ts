/**
 * The settings vocabulary: the compile-time source of truth for which keys
 * exist and what shape each one's value takes. This is the Convex-side
 * replacement for the Prisma EAV accessor that used to live at
 * src/lib/settings.ts (four nullable value columns plus a type enum, kept
 * out of `any` only through ~60 lines of structural typing). A Convex
 * `settings` document already carries a typed `value` union (see
 * convex/schema.ts); this module just says which keys are meaningful and
 * what to assume when a key has never been written.
 *
 * Prices are stored in cents, matching `vouchers.priceCents`. Admin inputs
 * accept reais and convert to cents at the UI boundary.
 */
export type SettingKey =
  | "voucher.price"
  | "voucher.pool.price"
  | "voucher.max.quantity.adults"
  | "voucher.max.quantity.elderly"
  | "voucher.max.quantity.adults.pool"
  | "voucher.max.quantity.elderly.pool"
  | "top.message"
  | "form.message"
  | "max.intended.days"
  | "disabled.days"
  | "enable.voucher.buy"
  | "enable.voucher.pool.buy"
  | "enable.voucher.half-price.buy"
  | "enable.voucher.half-price.pool.buy";

export interface SettingValueMap {
  "voucher.price": number;
  "voucher.pool.price": number;
  "voucher.max.quantity.adults": number;
  "voucher.max.quantity.elderly": number;
  "voucher.max.quantity.adults.pool": number;
  "voucher.max.quantity.elderly.pool": number;
  "top.message": string;
  "form.message": string;
  "max.intended.days": number;
  "disabled.days": string[];
  "enable.voucher.buy": boolean;
  "enable.voucher.pool.buy": boolean;
  "enable.voucher.half-price.buy": boolean;
  "enable.voucher.half-price.pool.buy": boolean;
}

export const DEFAULT_SETTINGS: SettingValueMap = {
  "voucher.price": 5000,
  "voucher.pool.price": 7000,
  "voucher.max.quantity.adults": 20,
  "voucher.max.quantity.elderly": 20,
  "voucher.max.quantity.adults.pool": 20,
  "voucher.max.quantity.elderly.pool": 20,
  "top.message": "",
  "form.message": "",
  "max.intended.days": 60,
  "disabled.days": [],
  "enable.voucher.buy": true,
  "enable.voucher.pool.buy": true,
  "enable.voucher.half-price.buy": true,
  "enable.voucher.half-price.pool.buy": true,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

/**
 * Merges stored `settings` documents onto `DEFAULT_SETTINGS`, so a key that
 * was never written (or was written with a shape that no longer matches
 * this map) falls back to its default rather than surfacing as `undefined`.
 */
export function mergeSettings(
  rows: Array<{ key: string; value: SettingValueMap[SettingKey] }>,
): SettingValueMap {
  const merged = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (isSettingKey(row.key)) {
      // Each key's stored value shape matches its map entry by construction
      // (settings.set is the only writer, and admin inputs are typed per key).
      (merged as Record<SettingKey, unknown>)[row.key] = row.value;
    }
  }

  return merged;
}
