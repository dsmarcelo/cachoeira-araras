import "server-only";

import { ConvexHttpClient } from "convex/browser";

import { env } from "@/env";
import { mintConvexIdentityToken } from "@/server/convex-auth-bridge";

/**
 * A Convex client authenticated as a trusted server-side caller, for paths
 * that establish trust another way before ever reaching Convex — e.g. the
 * Mercado Pago webhook route, which verifies MP's HMAC signature first.
 * Mints the same short-lived RS256 identity token a NextAuth session gets
 * (see convex-auth-bridge.ts), scoped to "admin" so the Convex function it
 * calls can require that role like any other admin-only function; there is
 * no separate "service" identity concept on the Convex side.
 */
export async function getConvexServiceClient(
  subject: string,
): Promise<ConvexHttpClient> {
  const token = await mintConvexIdentityToken(subject, "admin");
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(token);
  return client;
}
