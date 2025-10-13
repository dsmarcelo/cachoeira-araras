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
interface SettingValueMap {
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

type SettingTypeLiteral = "string" | "number" | "boolean" | "json";

// Minimal structural types to satisfy strict lint rules without depending on generated Prisma types
interface SiteSettingRow {
  type: SettingTypeLiteral;
  stringValue: string | null;
  numberValue: number | null;
  boolValue: boolean | null;
  jsonValue: unknown;
}

type SimpleWhere = {
  key: string;
};

interface SiteSettingDelegate {
  findUnique: (args: { where: SimpleWhere }) => Promise<SiteSettingRow | null>;
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
): Promise<SettingValueMap[K] | null> {
  const siteSetting = getSiteSettingDelegate(db);
  const row = await siteSetting.findUnique({
    where: { key },
  });
  if (!row) {
    // Provide sensible defaults when a setting is not yet stored
    const defaults: Partial<SettingValueMap> = {
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
    return (defaults[key] as SettingValueMap[K]) ?? null;
  }
  switch (row.type) {
    case "string":
      return row.stringValue as SettingValueMap[K] | null;
    case "number":
      return row.numberValue as SettingValueMap[K] | null;
    case "boolean":
      return row.boolValue as SettingValueMap[K] | null;
    case "json":
      return row.jsonValue as SettingValueMap[K] | null;
    default:
      return null;
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
  const { type, data } = inferSettingStorage(value);

  const siteSetting = getSiteSettingDelegate(db);
  return siteSetting.upsert({
    where: { key },
    update: { ...data, type, updatedBy },
    create: { key, type, updatedBy, ...data },
  });
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
