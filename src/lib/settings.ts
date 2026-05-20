// lib/settings.ts
// Strongly typed settings access aligned with Prisma enums and SiteSetting model
// Use the shared Prisma client to avoid multiple instances
import { db } from "@/server/db";

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

// Map each key to its expected value type for compile-time safety
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
  "disabled.days": string[]; // Array of ISO 8601 dates
  "enable.voucher.buy": boolean;
  "enable.voucher.pool.buy": boolean;
  "enable.voucher.half-price.buy": boolean;
  "enable.voucher.half-price.pool.buy": boolean;
}

export const DEFAULT_SETTINGS: SettingValueMap = {
  "voucher.price": 50,
  "voucher.pool.price": 70,
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

type SettingTypeLiteral = "string" | "number" | "boolean" | "json";

// Minimal structural types to satisfy strict lint rules without depending on generated Prisma types
interface SiteSettingRow {
  key?: string;
  type: SettingTypeLiteral;
  stringValue: string | null;
  numberValue: number | null;
  boolValue: boolean | null;
  jsonValue: unknown;
}

type SimpleWhere = {
  key: string;
};

type FindManyWhere = {
  key: {
    in: SettingKey[];
  };
};

interface SiteSettingDelegate {
  findUnique: (args: { where: SimpleWhere }) => Promise<SiteSettingRow | null>;
  findMany: (args: { where: FindManyWhere }) => Promise<SiteSettingRow[]>;
  upsert: (args: {
    where: SimpleWhere;
    update: Partial<
      Pick<
        SiteSettingRow,
        "stringValue" | "numberValue" | "boolValue" | "jsonValue"
      >
    > & { type: SettingTypeLiteral; updatedBy?: string };
    create: {
      key: string;
      type: SettingTypeLiteral;
      updatedBy?: string;
    } & Partial<
      Pick<
        SiteSettingRow,
        "stringValue" | "numberValue" | "boolValue" | "jsonValue"
      >
    >;
  }) => Promise<unknown>;
}

function getSiteSettingDelegate(source: unknown): SiteSettingDelegate {
  // Cast to a structural type to avoid any-typed access; this keeps call sites typed
  return (source as { siteSetting: SiteSettingDelegate }).siteSetting;
}

/**
 * Returns the value stored for a given setting key.
 * The return type is inferred from the key.
 */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValueMap[K]> {
  const siteSetting = getSiteSettingDelegate(db);
  const row = await siteSetting.findUnique({
    where: { key },
  });
  if (!row) {
    return DEFAULT_SETTINGS[key];
  }
  return readSettingValue(key, row);
}

function readSettingValue<K extends SettingKey>(
  key: K,
  row: SiteSettingRow,
): SettingValueMap[K] {
  let value: unknown;

  switch (row.type) {
    case "string":
      value = row.stringValue;
      break;
    case "number":
      value = row.numberValue;
      break;
    case "boolean":
      value = row.boolValue;
      break;
    case "json":
      value = row.jsonValue;
      break;
    default:
      value = undefined;
  }

  if (value === null || value === undefined) {
    return DEFAULT_SETTINGS[key];
  }

  try {
    return validateSettingValue(key, value);
  } catch (error) {
    console.error(`Invalid stored value for setting ${key}:`, error);
    return DEFAULT_SETTINGS[key];
  }
}

/**
 * Creates or updates a setting value with strict typing and Prisma enums.
 */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingValueMap[K] | Record<string, unknown>,
  { updatedBy }: { updatedBy?: string } = {},
): Promise<unknown> {
  const validValue = validateSettingValue(key, value);
  const { type, data } = inferSettingStorage(validValue);

  const siteSetting = getSiteSettingDelegate(db);
  return siteSetting.upsert({
    where: { key },
    update: { ...data, type, updatedBy },
    create: { key, type, updatedBy, ...data },
  });
}

/**
 * Retrieves all application settings at once.
 * This is the main DAL function for accessing settings.
 * Returns all settings with their default values if not yet stored.
 */
export async function getAllSettings(): Promise<SettingValueMap> {
  const siteSetting = getSiteSettingDelegate(db);
  const rows = await siteSetting.findMany({
    where: {
      key: {
        in: SETTING_KEYS,
      },
    },
  });
  const storedSettings = rows.flatMap(
    (row): Array<[SettingKey, SettingValueMap[SettingKey]]> => {
      if (!row.key || !isSettingKey(row.key)) {
        return [];
      }

      return [[row.key, readSettingValue(row.key, row)]];
    },
  );

  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(storedSettings),
  };
}

function isSettingKey(value: string): value is SettingKey {
  return SETTING_KEYS.includes(value as SettingKey);
}

function validateSettingValue<K extends SettingKey>(
  key: K,
  value: unknown,
): SettingValueMap[K] {
  if (key === "top.message" || key === "form.message") {
    if (typeof value !== "string") {
      throw new Error(`Invalid value for setting ${key}`);
    }
    return value as SettingValueMap[K];
  }

  if (key === "disabled.days") {
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item))
    ) {
      throw new Error("Invalid value for setting disabled.days");
    }
    return value as SettingValueMap[K];
  }

  if (key.startsWith("enable.")) {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid value for setting ${key}`);
    }
    return value as SettingValueMap[K];
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid value for setting ${key}`);
  }

  if (
    key.startsWith("voucher.max.quantity.") ||
    key === "max.intended.days"
  ) {
    if (!Number.isInteger(value)) {
      throw new Error(`Invalid integer value for setting ${key}`);
    }
  }

  return value as SettingValueMap[K];
}

// Infer the storage column and SettingType from the provided value
function inferSettingStorage(value: unknown): {
  type: SettingTypeLiteral;
  data: Partial<{
    stringValue: string;
    numberValue: number;
    boolValue: boolean;
    jsonValue: unknown;
  }>;
} {
  if (typeof value === "string") {
    return { type: "string", data: { stringValue: value } };
  }
  if (typeof value === "number") {
    return { type: "number", data: { numberValue: value } };
  }
  if (typeof value === "boolean") {
    return { type: "boolean", data: { boolValue: value } };
  }
  return { type: "json", data: { jsonValue: value } };
}
