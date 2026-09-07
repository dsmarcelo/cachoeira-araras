import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { authCredentialLimits, createAuth } from "./auth";

function getAdminCredentials() {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;

  if (
    !username ||
    username.length < authCredentialLimits.username.minLength ||
    username.length > authCredentialLimits.username.maxLength
  ) {
    throw new ConvexError(
      `ADMIN_USERNAME must contain between ${authCredentialLimits.username.minLength} and ${authCredentialLimits.username.maxLength} characters`,
    );
  }

  if (
    !password ||
    password.length < authCredentialLimits.password.minLength ||
    password.length > authCredentialLimits.password.maxLength
  ) {
    throw new ConvexError(
      `ADMIN_PASSWORD must contain between ${authCredentialLimits.password.minLength} and ${authCredentialLimits.password.maxLength} characters`,
    );
  }

  return { username, password };
}

/**
 * Creates the first administrator using the selected Convex deployment's
 * environment. This stays internal so anonymous requests cannot create admins.
 */
export const createFirstAdmin = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
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

    const { username, password } = getAdminCredentials();

    await createAuth(ctx).api.createUser({
      body: {
        email: `user-${crypto.randomUUID()}@internal.invalid`,
        name: username,
        password,
        role: "admin",
        data: {
          username,
          displayUsername: username,
        },
      },
    });

    return null;
  },
});
