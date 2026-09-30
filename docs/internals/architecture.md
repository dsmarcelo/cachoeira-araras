# Architecture and access

Next.js serves the public site, staff UI and HTTP adapters. Convex owns application data, authorization, transactional Voucher changes and scheduled work. Clients subscribe directly to Convex so external payment changes reach operational screens without a separate RPC layer.

Better Auth stores accounts, credentials and sessions in its Convex component. Each privileged operation checks the current user record; bans and role changes do not rely on caller-supplied roles. The ordinary Better Auth role maps to employee; administrators inherit employee access. Usernames replace email in the login experience; internal account emails are opaque placeholders.

Anonymous code lookup is rate limited and yields an opaque Voucher-scoped capability for subsequent reads. Purchase management requires a separate management token. Image generation requires the Voucher lookup capability as well as the server service secret. Possession of a short code is not unrestricted access to buyer data or purchase management.

Public lookup shares a token bucket of 60 attempts per minute. Checkout buckets allow 3 attempts per phone per 10 minutes and 60 globally per minute. Staff gate lookup uses authenticated access independently of the anonymous bucket.

Checkout validates availability and quantities, derives price on the backend, and enforces code uniqueness and the one-live-Pending-purchase rule transactionally. New codes have six characters; legacy four-character codes remain supported. External checkout creation and database insertion are not one atomic transaction; provider side effects require their own recovery handling.

PostgreSQL and Prisma remain tooling for legacy import and the payment E2E script, rather than the application's live data store. Do not treat the presence of Prisma as a second runtime source of truth.
