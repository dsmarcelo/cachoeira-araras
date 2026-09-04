import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

import { authComponent } from "../auth";

/**
 * Application roles. Better Auth stores its ordinary role as "user"; this
 * adapter maps that value to the application's existing "employee" name.
 */
export type UserRole = "admin" | "employee";

/**
 * Reads the caller's current role from Better Auth. Looking the user up on
 * every authorization check makes bans and role changes effective without
 * trusting a stale client token or a role function argument.
 */
export async function getRole(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<UserRole | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user || user.banned === true) {
    return null;
  }

  return user.role === "admin" ? "admin" : "employee";
}

/** Throws unless the caller is signed in as `role` (or "admin", which can do anything "employee" can). */
export async function requireRole(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  role: UserRole,
): Promise<UserRole> {
  const actual = await getRole(ctx);
  if (actual === null) {
    throw new Error("401: not signed in");
  }
  if (role === "admin" && actual !== "admin") {
    throw new Error("403: forbidden");
  }
  return actual;
}
