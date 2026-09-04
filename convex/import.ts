import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { referrerValidator, voucherStatusValidator } from "./vouchers";

/**
 * Internal write side of the Postgres-to-Convex import
 * (scripts/import-postgres-to-convex). These are never reachable from a
 * client: the standalone script is the only caller, invoked via
 * `npx convex run import:importVouchers` against a chosen deployment.
 *
 * Idempotent by design: a row whose natural key (Voucher Code / setting
 * key) already exists is left untouched and reported "unchanged", so
 * re-running the script never produces duplicates or overwrites data a
 * live app may have already written for that key.
 */

const importOutcome = v.union(v.literal("inserted"), v.literal("unchanged"));

const voucherImportValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  priceCents: v.number(),
  status: voucherStatusValidator,
  visitDate: v.string(),
  expiresAt: v.number(),
  preferenceId: v.string(),
  paymentId: v.optional(v.string()),
  referrer: v.optional(referrerValidator),
  deletedAt: v.optional(v.number()),
});

/**
 * Imports a batch of already-transformed Vouchers. `isTest` is not part of
 * the import shape and is always written `false`: the flag did not exist in
 * the legacy schema, so nothing legacy can honestly be marked a Test
 * Voucher.
 */
export const importVouchers = internalMutation({
  args: { rows: v.array(voucherImportValidator) },
  returns: v.array(v.object({ code: v.string(), outcome: importOutcome })),
  handler: async (ctx, args) => {
    const results: { code: string; outcome: "inserted" | "unchanged" }[] = [];

    for (const row of args.rows) {
      const existing = await ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", row.code))
        .unique();

      if (existing) {
        results.push({ code: row.code, outcome: "unchanged" });
        continue;
      }

      await ctx.db.insert("vouchers", { ...row, isTest: false });
      results.push({ code: row.code, outcome: "inserted" });
    }

    return results;
  },
});

const settingValueValidator = v.union(
  v.number(),
  v.string(),
  v.boolean(),
  v.array(v.string()),
);

const settingImportValidator = v.object({
  key: v.string(),
  value: settingValueValidator,
  updatedBy: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
});

/** Imports a batch of already-typed Site Settings, preserving their audit fields. */
export const importSettings = internalMutation({
  args: { rows: v.array(settingImportValidator) },
  returns: v.array(v.object({ key: v.string(), outcome: importOutcome })),
  handler: async (ctx, args) => {
    const results: { key: string; outcome: "inserted" | "unchanged" }[] = [];

    for (const row of args.rows) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", row.key))
        .unique();

      if (existing) {
        results.push({ key: row.key, outcome: "unchanged" });
        continue;
      }

      await ctx.db.insert("settings", row);
      results.push({ key: row.key, outcome: "inserted" });
    }

    return results;
  },
});
