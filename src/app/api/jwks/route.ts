import { NextResponse } from "next/server";

import { getConvexAuthPublicJwk } from "@/server/convex-auth-bridge";

/**
 * JWKS discovery endpoint for Convex's customJwt auth provider
 * (convex/auth.config.ts). Serves the public half of the keypair that signs
 * tokens minted by /api/auth/convex-token. Rewritten from the conventional
 * /.well-known/jwks.json path in next.config.js.
 */
export function GET() {
  return NextResponse.json(
    { keys: [getConvexAuthPublicJwk()] },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
