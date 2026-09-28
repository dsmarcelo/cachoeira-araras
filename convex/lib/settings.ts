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
 * Prices are read from the Convex deployment environment in reais and
 * converted to cents, matching `vouchers.priceCents`.
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
  "voucher.price": 7000,
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

const PRICE_ENV_KEYS = {
  "voucher.price": "NEXT_PUBLIC_VOUCHER_PRICE",
  "voucher.pool.price": "NEXT_PUBLIC_POOL_VOUCHER_PRICE",
} as const;

export function isPriceSetting(key: string): key is keyof typeof PRICE_ENV_KEYS {
  return Object.hasOwn(PRICE_ENV_KEYS, key);
}

function priceFromEnv(key: keyof typeof PRICE_ENV_KEYS): number {
  const raw = process.env[PRICE_ENV_KEYS[key]]?.trim();
  if (!raw) return DEFAULT_SETTINGS[key];

  const match = /^(\d+)(?:[.,](\d+))?$/.exec(raw);
  const fraction = match?.[2] ?? "";
  const cents = match
    ? Math.max(
        1,
        Number(match[1]) * 100 +
          Number(fraction.slice(0, 2).padEnd(2, "0")) +
          (Number(fraction[2] ?? "0") >= 5 ? 1 : 0),
      )
    : NaN;
  if (
    !Number.isSafeInteger(cents) ||
    !match ||
    (Number(match[1]) === 0 && !/[1-9]/.test(fraction))
  ) {
    throw new Error(`${PRICE_ENV_KEYS[key]} deve ser um valor positivo em reais.`);
  }
  return cents;
}

export function getVoucherPrices() {
  return {
    "voucher.price": priceFromEnv("voucher.price"),
    "voucher.pool.price": priceFromEnv("voucher.pool.price"),
  };
}

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

/**
 * Merges stored settings with defaults. Prices always come from the
 * deployment environment, even when older price rows remain in the database.
 */
export function mergeSettings(
  rows: Array<{ key: string; value: SettingValueMap[SettingKey] }>,
): SettingValueMap {
  const merged = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (isSettingKey(row.key) && !isPriceSetting(row.key)) {
      // Each key's stored value shape matches its map entry by construction
      // (settings.set is the only writer, and admin inputs are typed per key).
      (merged as Record<SettingKey, unknown>)[row.key] = row.value;
    }
  }

  return { ...merged, ...getVoucherPrices() };
}
