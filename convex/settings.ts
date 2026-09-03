import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";

/**
 * Demonstrates the requireRole auth-bridge pattern (ticket 04): role comes
 * only from the verified identity, never from a function argument, and
 * `set` is admin-only while `get` stays public.
 */

export const get = query({
  args: { key: v.string() },
  returns: v.union(
    v.object({
      key: v.string(),
      value: v.union(v.number(), v.string(), v.boolean(), v.array(v.string())),
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

export const set = mutation({
  args: {
    key: v.string(),
    value: v.union(v.number(), v.string(), v.boolean(), v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }

    return null;
  },
});
