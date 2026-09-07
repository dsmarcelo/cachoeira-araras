# 02: Use the correct origin in local checkout

**What to build:** Make the configuration of URLs used by checkout and webhook explicit and safe, keeping purchase and return on the same origin during local testing so that browser history remains available.

`WEBHOOK_URL` in Convex is currently configured as `https://cda-dev.vercel.app/webhook` (with a path). `buildMercadoPagoWebhookUrl` (`src/server/mercadopago-checkout.ts:23`) constructs `new URL("/api/webhook", base)`. Because `/api/webhook` is absolute, the configured `/webhook` is silently discarded. This works by accident and contradicts the README requirement for a base URL without trailing path.

Additionally, testing checkout on `localhost:3000` always redirects the customer back to `cda-dev.vercel.app` because `resolveSiteBaseForCheckout` reads `URL` from the Convex deployment (`convex/lib/mercadopago.ts:84`). Both share the same Convex deployment, but `localStorage` is not shared across origins. The local flow needs aligned purchase and return origins, along with documented tunnel usage and verification of the fallback recovery when local storage is absent.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Webhook configuration accepts only a base URL without a path and fails with a clear message when receiving an invalid value containing a path.
- [ ] The development environment uses the correct base URL without relying on silently discarding a configured path.
- [ ] The documented local flow keeps purchase and return on the same origin, including tunnel usage when necessary, documented in README.
- [ ] Returning to an origin without local history continues using existing recovery (PR 2 fallback) without breaking the payment screen.

Implementation notes:
- PR reference: PR 4 (`fix(ops): corrige WEBHOOK_URL e documenta a base pública local`) — Size: XS, Impact: Low (prevents expensive future debugging).
- References: `src/server/mercadopago-checkout.ts:23` (`buildMercadoPagoWebhookUrl`), `convex/lib/mercadopago.ts:84` (`resolveSiteBaseForCheckout`), Convex deployment env `WEBHOOK_URL`.
