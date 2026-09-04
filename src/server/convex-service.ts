import "server-only";

import { env } from "@/env";

/**
 * Calls a Convex HTTP action (convex/http.ts) authenticated with a shared
 * secret, for paths that establish trust another way before ever reaching
 * Convex — e.g. the Mercado Pago webhook route, which verifies MP's HMAC
 * signature first. No Convex identity token is minted for this caller; the
 * `x-webhook-secret` header is the only credential, checked on the Convex
 * side against `MERCADOPAGO_WEBHOOK_SERVICE_SECRET`.
 */
export async function callConvexService<T>(
  path: `/${string}`,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${convexSiteUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Convex service call to ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

// Convex HTTP actions are served from the deployment's `.convex.site`
// origin, not the `.convex.cloud` origin the client SDK talks to.
function convexSiteUrl(): string {
  return env.NEXT_PUBLIC_CONVEX_URL.replace(/\.convex\.cloud$/, ".convex.site");
}
