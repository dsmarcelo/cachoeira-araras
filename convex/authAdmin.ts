import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { createAuth } from "./auth";

/**
 * Creates the first administrator from the Convex CLI. This stays internal so
 * the public app can never turn an anonymous request into an admin account.
 */
export const createFirstAdmin = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const users: unknown = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "user",
        paginationOpts: { cursor: null, numItems: 1 },
      },
    );

    if (
      typeof users !== "object" ||
      users === null ||
      !("page" in users) ||
      !Array.isArray(users.page)
    ) {
      throw new ConvexError("Could not inspect existing users");
    }

    if (users.page.length > 0) {
      throw new ConvexError("The first user already exists");
    }

    await createAuth(ctx).api.createUser({
      body: {
        email: `user-${crypto.randomUUID()}@internal.invalid`,
        name: args.username,
        password: args.password,
        role: "admin",
        data: {
          username: args.username,
          displayUsername: args.username,
        },
      },
    });

    return null;
  },
});
