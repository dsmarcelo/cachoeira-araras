# 04: Auth bridge — NextAuth session to verified Convex identity

**What to build:** Someone logged in as staff or admin makes every Convex function see a
verified role. A visitor with no session, or one who forges a role in a function argument, is
treated as public.

NextAuth remains the login mechanism with its two role passwords. It gains an endpoint
minting a short-lived asymmetric token carrying the role claim, and a route serving the
matching public keys; Convex verifies against that. This bridge exists only because tRPC no
longer terminates every privileged request server-side (ADR-0001). Convex's custom JWT
provider accepts only RS256 or ES256, and the NextAuth session token is symmetrically
encrypted, so it cannot be handed over directly.

**Blocked by:** 03

**Status:** resolved

- [x] Logging in as admin and as staff each results in Convex functions seeing that role.
- [x] Logging out, or never logging in, results in no identity rather than a stale one.
- [x] The client refreshes the short-lived token without the user noticing an expiry.
- [x] A public function called with a `role` argument present ignores it entirely.
- [x] A staff-only function rejects a public caller; an admin-only function rejects a staff
      caller; both reject a forged role argument.
- [x] Role is never read from a function argument anywhere in the codebase.
- [x] The redundant `USER_ROLES.includes(role)` check from the tRPC layer is not reproduced;
      it was equivalent to the authenticated check it wrapped.
