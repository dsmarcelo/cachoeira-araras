import { NextResponse } from "next/server";

import { getCurrentUserRole, getServerAuthSession } from "@/server/auth";
import { mintConvexIdentityToken } from "@/server/convex-auth-bridge";

/**
 * Mints a short-lived Convex identity token for the caller's current
 * NextAuth session. Called by the client's `useAuth` adapter
 * (ConvexProviderWithAuth) to fetch/refresh the token Convex verifies via
 * `convex/auth.config.ts`'s customJwt provider. No session -> 401, never a
 * token for an anonymous caller.
 */
export async function GET() {
  const [session, role] = await Promise.all([
    getServerAuthSession(),
    getCurrentUserRole(),
  ]);

  if (!session?.user || !role) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const token = await mintConvexIdentityToken(session.user.id, role);

  return NextResponse.json({ token });
}
