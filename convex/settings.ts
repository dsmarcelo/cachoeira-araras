import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";

/**
 * Role comes only from the verified identity (ticket 04), never from a
 * function argument: `get`/`list` stay public reads, `set` is admin-only.
 * Per-key documents (rather than one settings document) mean two admins
 * editing different keys at the same time patch different rows and cannot
 * clobber each other.
 */

const settingValue = v.union(
  v.number(),
  v.string(),
  v.boolean(),
  v.array(v.string()),
);

export const get = query({
  args: { key: v.string() },
  returns: v.union(
    v.object({
      key: v.string(),
      value: settingValue,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    return setting ? { key: setting.key, value: setting.value } : null;
  },
});

/**
 * Every stored setting with its audit trail, for the admin settings page.
 * Admin-only because `updatedBy` identifies who made the change; visitors
 * only ever need `get`/individual values, never the audit trail.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      value: settingValue,
      updatedBy: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    // Bounded by the settings vocabulary (SETTING_KEYS in src/lib/settings.ts,
    // currently ~14 entries) rather than user-generated data, so a full
    // table scan here never grows unboundedly.
    const settings = await ctx.db.query("settings").collect();
    return settings.map((setting) => ({
      key: setting.key,
      value: setting.value,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    }));
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    value: settingValue,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentityForAudit(ctx);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    const patch = {
      value: args.value,
      updatedBy: identity,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("settings", { key: args.key, ...patch });
    }

    return null;
  },
});

/** Requires admin and returns the identity's subject, to stamp `updatedBy`. */
async function requireIdentityForAudit(
  ctx: Parameters<typeof requireRole>[0],
): Promise<string> {
  await requireRole(ctx, "admin");
  const identity = await ctx.auth.getUserIdentity();
  // requireRole already guarantees a signed-in admin identity exists.
  return identity!.subject;
}
