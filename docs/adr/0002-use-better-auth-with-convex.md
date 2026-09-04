# Use Better Auth with Convex

Status: accepted

The admin area needs named accounts, live role changes, password management,
and the same login flow on localhost and Vercel. The previous NextAuth bridge
stored shared password hashes in Next.js environment variables and depended on
a Next.js-hosted JWKS endpoint. That made local testing depend on a deployed
frontend.

The app now uses Better Auth's username and admin plugins. Better Auth stores
users, credentials, sessions, roles, and bans in its component on Convex. The
browser never asks for an email address. Better Auth still requires an email
field internally, so account creation supplies an opaque `.invalid` value.

Application role `employee` maps to Better Auth's built-in `user` role. Convex
authorization reads the current user record for each privileged operation, so
role changes and bans do not trust caller-supplied claims.

## Consequences

Local Next.js development talks to a remote Convex development deployment.
That deployment accepts `http://localhost:3000` through its `SITE_URL` setting.
No local Convex database or Vercel push is required.

Each Convex deployment needs its own `BETTER_AUTH_SECRET` and `SITE_URL`.
Production configuration remains a separate, explicit deployment operation.
An internal Convex action creates the first administrator and refuses to run
after the first user exists. Later account management happens in the admin UI.
