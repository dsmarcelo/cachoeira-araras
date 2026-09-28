import { env } from "../_generated/server";

function readSiteUrl(): string {
  const configured = env.SITE_URL?.trim();
  if (configured) return configured;
  return "http://localhost:3000";
}

/**
 * Public app origin, read from the Convex deployment's `SITE_URL`. The single
 * source for Better Auth's base URL and Mercado Pago's back_urls and webhook.
 */
export const siteUrl = readSiteUrl();
