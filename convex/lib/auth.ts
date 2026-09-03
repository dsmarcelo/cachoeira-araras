import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * The two roles minted into the Convex identity token by
 * src/server/convex-auth-bridge.ts. Kept in sync with `UserRole` in
 * src/server/auth.ts (that file's literal is "employee", not "staff",
 * despite the phrase used elsewhere).
 */
export type UserRole = "admin" | "employee";

/**
 * Reads the caller's verified role from the Convex identity, or `null` for
 * an unauthenticated caller. Custom JWT claims are nested under `properties`
 * (see convex/auth.config.ts + the token-minting route) and Convex exposes
 * them back under a dot-notation key — never trust a `role` function
 * argument instead of this.
 */
export async function getRole(
  ctx: QueryCtx | MutationCtx,
): Promise<UserRole | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const role = identity["properties.role"];
  return role === "admin" || role === "employee" ? role : null;
}

/** Throws unless the caller is signed in as `role` (or "admin", which can do anything "employee" can). */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
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
