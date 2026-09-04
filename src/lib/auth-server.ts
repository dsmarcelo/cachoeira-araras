import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

import { api } from "../../convex/_generated/api";

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});

export type CurrentAuthUser = {
  id: string;
  name: string;
  username: string;
  role: "admin" | "employee";
};

/** Keeps route guards strict while Convex refreshes its generated API types. */
export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const user: unknown = await fetchAuthQuery(api.auth.currentUser);

  if (
    typeof user !== "object" ||
    user === null ||
    !("id" in user) ||
    typeof user.id !== "string" ||
    !("name" in user) ||
    typeof user.name !== "string" ||
    !("username" in user) ||
    typeof user.username !== "string" ||
    !("role" in user) ||
    (user.role !== "admin" && user.role !== "employee")
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}
