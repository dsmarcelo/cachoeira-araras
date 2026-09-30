# Environment setup and deployment

Use Node 24 and the repository's pinned pnpm version. Install with `pnpm install`. Use `.env.example` for frontend configuration and never commit credentials. Local development uses a remote Convex development deployment; inspect an existing app at `http://localhost:3000` before starting another process.

## Environment boundaries

The frontend requires both public Convex URLs, the Mercado Pago token and the webhook service secret. The cloud and HTTP URLs must identify the same deployment. Production also requires `WEBHOOK_SECRET` for signature verification.

Configure the selected Convex deployment separately with `BETTER_AUTH_SECRET`, `SITE_URL`, `MERCADOPAGO_TOKEN` and the matching `MERCADOPAGO_WEBHOOK_SERVICE_SECRET`. Environment files do not configure remote backend secrets. `SITE_URL` is the public origin used for authentication, payment returns and notifications. Use localhost for ordinary local login; webhook testing needs a reachable origin. Add additional authentication origins through `AUTH_TRUSTED_ORIGINS` when needed.

Set standard and pool prices through `NEXT_PUBLIC_VOUCHER_PRICE` and `NEXT_PUBLIC_POOL_VOUCHER_PRICE` in both environments. Values are in reais; checkout uses the Convex values, defaults to R$ 70 per category, and converts to cents. Stored legacy price settings do not override deployment prices. Keep frontend and backend values aligned.

Optional marketing, content and Sentry settings are listed in `.env.example`. Missing monitoring credentials disable capture; they do not prove the payment flow is healthy.

## Deploy

1. Identify the frontend environment and Convex deployment explicitly; verify their URLs and payment account before any write.
2. Run `pnpm lint`, `pnpm type-check`, `pnpm test:convex`, `pnpm test:webhook` and `pnpm build` for a release affecting backend or payment behavior. Run `pnpm test:import` for import changes.
3. Configure secrets on the target deployment and deploy the backend with the repository's Convex CLI (`pnpm exec convex deploy` for production). Deploy the frontend with the matching public URLs and rebuild after public environment changes.
4. Verify staff login, purchase, provider approval, Voucher visibility and one-time gate redemption in the target environment. Check Convex scheduled work and webhook errors.

The payment E2E script contacts Mercado Pago and uses legacy PostgreSQL; use only deliberate test credentials and a test database. It is not a substitute for validating the live Convex purchase path.

## First administrator

On a deployment with no users, configure `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then run `pnpm exec convex run authAdmin:createFirstAdmin` against that explicit target (add `--prod` for production). Usernames accept 3–30 characters and passwords 5–128. Remove the provisioning credentials afterward. Subsequent accounts are managed through the administrator UI; the provisioning action refuses to run once a user exists.
