import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { admin, username } from "better-auth/plugins";
import { v } from "convex/values";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

function toAppRole(role: unknown): "admin" | "employee" {
  return role === "admin" ? "admin" : "employee";
}

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  { local: { schema: authSchema } },
);

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    trustedOrigins: [siteUrl],
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
      }),
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}

export const { getAuthUser } = authComponent.clientApi();

export const currentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      name: v.string(),
      username: v.string(),
      role: v.union(v.literal("admin"), v.literal("employee")),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (
      !user ||
      user.banned === true ||
      typeof user.username !== "string"
    ) {
      return null;
    }

    return {
      id: user._id,
      name: user.name,
      username: user.username,
      role: toAppRole(user.role),
    };
  },
});
