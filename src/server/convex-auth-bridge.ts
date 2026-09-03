import { importPKCS8, SignJWT, type JWK } from "jose";

import { env } from "@/env.js";
import type { UserRole } from "@/server/auth";

/**
 * NextAuth-to-Convex identity bridge.
 *
 * Convex's `customJwt` auth provider only accepts RS256/ES256 tokens, and
 * the NextAuth session cookie is symmetrically encrypted (NEXTAUTH_SECRET),
 * so it can't be handed to Convex directly. Instead, `/api/auth/convex-token`
 * mints a short-lived RS256 token carrying the *verified* role (never a
 * client-supplied value), and `/.well-known/jwks.json` publishes the public
 * key so `convex/auth.config.ts` can verify it.
 */

// Issuer/audience Convex's customJwt provider checks against. Must match
// convex/auth.config.ts exactly.
export const CONVEX_AUTH_ISSUER = env.URL;
export const CONVEX_AUTH_AUDIENCE = "convex";
export const CONVEX_AUTH_ALGORITHM = "RS256";
export const CONVEX_AUTH_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export function getConvexAuthPublicJwk(): JWK {
  return JSON.parse(env.CONVEX_AUTH_PUBLIC_JWK) as JWK;
}

async function getConvexAuthPrivateKey() {
  const pem = Buffer.from(env.CONVEX_AUTH_PRIVATE_KEY_B64, "base64").toString(
    "utf8",
  );
  return importPKCS8(pem, CONVEX_AUTH_ALGORITHM);
}

/**
 * Mints a Convex identity token for an already-authenticated NextAuth
 * session. `role` must come from the verified server-side session (e.g.
 * `getCurrentUserRole()`) — never from client input. Custom claims are
 * nested under `properties` per Convex's customJwt claim convention, read
 * back in Convex functions via `identity["properties.role"]`.
 */
export async function mintConvexIdentityToken(
  userId: string,
  role: UserRole,
): Promise<string> {
  const privateKey = await getConvexAuthPrivateKey();
  const { kid } = getConvexAuthPublicJwk();

  return new SignJWT({ properties: { role } })
    .setProtectedHeader({ alg: CONVEX_AUTH_ALGORITHM, kid })
    .setIssuer(CONVEX_AUTH_ISSUER)
    .setAudience(CONVEX_AUTH_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${CONVEX_AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(privateKey);
}
