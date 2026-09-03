# Spec: Replace Prisma/Postgres with Convex

Status: ready-for-agent

## Problem Statement

The voucher business runs on a Next.js app backed by Prisma and a hosted Postgres database, with tRPC as the API layer between browser and server.

Three problems fall out of that arrangement:

**Staff see stale data at the moment it matters most.** The gate list, the admin voucher table, and the sales dashboards are all request/response reads. A Mercado Pago webhook can flip a voucher from Pending to Valid while a customer is standing at the entrance, and the screen in the operator's hand will not know until someone refreshes it.

**The data model carries artifacts of the tools rather than the domain.** A voucher's state is stored twice (`status` string and `valid` boolean) and can disagree. The customer's chosen visit date and the voucher's expiry are the same column, so reactivating a voucher silently rewrites the date the customer chose. Site settings live in an EAV table whose four nullable value columns require roughly sixty lines of structural typing to access without `any`. Four NextAuth tables exist and are never read, because authentication is JWT-based with password hashes in environment variables.

**Test purchases pollute production.** Staff can buy a voucher for R$0,01 to exercise the real payment path, but the resulting row is an ordinary voucher: it appears in the admin list, the gate list, and the sales summaries, dragging average ticket toward zero. Worse, the payment webhook fires Facebook Pixel and Google Ads conversion events for every approved payment with no test filter, so every test purchase has been telling both ad platforms a conversion is worth one centavo.

## Solution

Move the backend to Convex, delete tRPC, and use the schema rewrite as the one moment where the data model can be corrected without a series of risky in-place migrations.

Browsers subscribe to Convex queries directly, so the gate list and admin tables update live when a webhook confirms a payment. Voucher state becomes a single `status` union. Visit Date and Expiry become two fields with one meaning each. Prices become integer cents. Site settings become one document per key with a union validator, deleting the EAV machinery. Referrer attribution is embedded on the Voucher it describes. Test Vouchers carry a server-set `isTest` flag that excludes them from every operational view and suppresses ad conversion events, while remaining redeemable by code so the full purchase path stays testable.

Existing data stays in Postgres and is imported in a single cutover. Nothing about the current production database changes.

## User Stories

### Visitor buying a voucher

1. As a visitor, I want to choose entry types and a visit date and be shown the correct total, so that I know what I am paying before I commit.
2. As a visitor, I want the price to be derived by the server from current settings, so that a stale or tampered browser cannot change what I am charged.
3. As a visitor, I want to be blocked from picking a date in the past, beyond the configured booking window, or on a disabled day, so that I do not buy a voucher I cannot use.
4. As a visitor, I want to be stopped at checkout if my phone number already has a valid voucher, so that I do not accidentally buy a second one.
5. As a visitor, I want to be sent to Mercado Pago and returned to a page that reflects my real payment state, so that I know whether the purchase succeeded.
6. As a visitor, I want my voucher code to be short and unique, so that I can read it aloud at the gate.
7. As a visitor, I want my voucher to become valid as soon as my payment is approved, without me refreshing anything, so that I can enter without waiting.
8. As a visitor, I want to look up my voucher's status by code without logging in, so that I can confirm it before travelling.
9. As a visitor, I want a failed or abandoned payment to leave no permanent trace on my phone number, so that I can try again later.
10. As a visitor, I want to receive a WhatsApp message with my code, date, entry counts and amount, so that I have a record outside the browser.

### Gate staff

11. As gate staff, I want a list of the vouchers expected today, so that I can see who is coming without searching.
12. As gate staff, I want that list to update live as payments are confirmed, so that a customer who paid two minutes ago appears without a refresh.
13. As gate staff, I want the day to roll over at midnight in Sao Paulo time, so that the list is correct for the country the business operates in.
14. As gate staff, I want to redeem a voucher by typing its code, so that entry is fast at a physical gate.
15. As gate staff, I want a redeemed voucher to be visibly terminal, so that I cannot admit the same party twice.
16. As gate staff, I want to be refused when redeeming a voucher outside today's operational window, so that I do not admit a party on the wrong day.
17. As gate staff, I want to reactivate a voucher when a customer has a legitimate reason, so that I can resolve a problem at the gate.
18. As gate staff, I want reactivating a voucher not to overwrite the visit date the customer originally chose, so that reporting stays truthful.
19. As gate staff, I want Test Vouchers hidden from my list by default, so that my operational view shows only real customers.
20. As gate staff, I want to still be able to redeem a Test Voucher by typing its code, so that the full purchase-to-entry path can be verified.

### Admin

21. As an admin, I want to browse all vouchers with pagination, so that I can find any record.
22. As an admin, I want to search by code, name, or phone using substring matching, so that a partial memory of any of them is enough.
23. As an admin, I want to filter by status and by creation date range, so that I can narrow a large list.
24. As an admin, I want the voucher list to update live, so that I am not looking at a stale table while payments arrive.
25. As an admin, I want a summary of vouchers, visitors, and revenue for a bounded date range, so that I can understand a period.
26. As an admin, I want revenue arithmetic to be exact, so that totals do not drift from floating-point accumulation.
27. As an admin, I want Test Vouchers excluded from every summary and revenue figure, so that my numbers describe real business.
28. As an admin, I want daily sales broken down by day, so that I can see trends.
29. As an admin, I want to edit a voucher's status when something needs correcting, so that records can be fixed.
30. As an admin, I want to soft-delete a voucher, so that a mistake is reversible.
31. As an admin, I want to see soft-deleted vouchers separately, so that I can audit or restore them.
32. As an admin, I want to edit site settings — prices, quantity limits, booking window, disabled days, feature toggles, banner messages — so that I can run the business without a deploy.
33. As an admin, I want each setting change to record who made it and when, so that a surprising change can be traced.
34. As an admin, I want settings changes to take effect for visitors immediately, so that a price change or a closure is honoured at once.
35. As an admin, I want referrer attribution visible per voucher, so that I can see which channel produced a sale.
36. As an admin, I want to send a WhatsApp message to a customer, so that I can resend a lost voucher.

### Staff testing the purchase flow

37. As staff, I want to buy a voucher for R$0,01 through the real Mercado Pago integration, so that I verify production credentials, webhook signature, and notification URL together.
38. As staff, I want the test purchase form at a predictable admin URL, so that I do not need to remember an obscured path.
39. As staff, I want test mode authorised by my session role on the server, so that a visitor cannot buy at R$0,01 by manipulating the client.
40. As staff, I want a Test Voucher marked as such by the server rather than by a name I type, so that the marking cannot be forgotten or edited away.
41. As staff, I want test purchases to fire no Facebook or Google conversion events, so that advertising optimisation is not trained on one-centavo conversions.
42. As staff, I want the WhatsApp message to still send for a test purchase, so that message delivery is part of what I am verifying.
43. As staff, I want Test Vouchers cleaned up automatically after thirty days, so that they do not accumulate forever.

### Developer

44. As a developer, I want one backend platform rather than a database, an ORM, and an RPC layer, so that there are fewer moving parts to reason about.
45. As a developer, I want schema and validators to be the single source of truth for data shape, so that documentation cannot drift from reality.
46. As a developer, I want the code-uniqueness check and the voucher insert to occur in one transaction, so that concurrent checkouts cannot produce a duplicate code.
47. As a developer, I want payment confirmation to be idempotent, so that Mercado Pago's repeated webhook deliveries do not double-process a payment.
48. As a developer, I want a single helper expressing "vouchers that count", so that the soft-delete and test-voucher predicates cannot be forgotten in a new query.
49. As a developer, I want to import existing Postgres data in one scripted, re-runnable step, so that cutover is not a manual data-entry exercise.
50. As a developer, I want to dry-run the import against a development database before touching production, so that transformation bugs surface early.
51. As a developer, I want the production database untouched until cutover, so that the migration can be abandoned with zero consequence.

## Implementation Decisions

### Architecture

- tRPC is removed entirely. Browsers call Convex queries, mutations, and actions directly. This is recorded as ADR-0001.
- NextAuth remains the login mechanism with its two role passwords and JWT session. It gains a token endpoint minting a short-lived RS256 JWT carrying the role claim, and a route serving the corresponding JWKS. Convex `auth.config.ts` registers a `customJwt` provider pointing at that JWKS. Convex's custom JWT provider accepts only RS256 or ES256, so NextAuth's symmetric JWE session token cannot be used directly. Client wiring uses `ConvexProviderWithAuth` with refresh.
- Every Convex function derives role from the verified identity. Client-supplied role or identity arguments are never trusted.
- Cutover is big-bang from a branch. Prisma remains authoritative in production for the entire duration.

### Schema

Single `vouchers` table:

- `code` is the identity. The Prisma autoincrement `id` is dropped with no replacement surrogate; nothing carries it forward.
- `status` is a union of `pending`, `valid`, `redeemed`, `expired`. The `valid` boolean is removed; it was always derivable as `status === "valid"`. The legacy `used` value is normalised to `redeemed` during import and does not appear in the validator.
- `visitDate` and `expiresAt` become two separate fields. `visitDate` is the day the customer chose at purchase and is never written by staff. `expiresAt` is when the voucher stops being redeemable. The current schema conflates both in `expires_at`, which is why reactivation corrupts reporting.
- `priceCents` is an integer. Settings prices are also stored in cents. Conversion to decimal reais happens only at two boundaries: the Mercado Pago `unit_price` field, and currency formatting for display. Admin settings inputs accept reais and convert on write.
- `referrer` is an optional embedded object (`source`, `url`) replacing the separate `Referrer` table, which was 1:1 with `Voucher` via a unique `voucherCode`.
- `isTest` is a boolean set server-side from the same authorisation check that permits test-mode pricing. It is never accepted from client input.
- `deletedAt` soft-delete is retained.
- The four NextAuth tables (`User`, `Account`, `Session`, `VerificationToken`) are not ported. `@auth/prisma-adapter` is removed from dependencies; it was installed but never imported.

Settings:

- One document per key, holding the key, a value typed as a union of the shapes the settings vocabulary actually uses, and `updatedBy`. The `type` enum, the four nullable value columns, and the delegate-shaped structural typing used to keep `any` out of the current accessor are all deleted. The existing key-to-type map remains the compile-time source of truth.
- Per-key documents rather than one settings document, so that two admins editing the configuration page concurrently do not clobber each other.

### Functions

- Checkout is one Convex action. It derives price from settings, generates a code, creates the Mercado Pago preference, then calls an internal mutation that re-checks code uniqueness and inserts the voucher atomically. A collision inside that mutation causes the action to retry with a new code. This closes an existing time-of-check/time-of-use race where the uniqueness check and the insert are separate Prisma calls.
- `validateVoucherPurchase` stays a pure function taking input and settings. The remaining dependency-injection seam in the intake core — roughly eight function-typed parameters — is collapsed into the action and its internal mutation, since its purpose was testability without a database and `convex-test` supplies one.
- The Mercado Pago webhook remains a Next.js route through cutover. Live checkout preferences carry `notification_url` baked in at creation and expire ten days later, so relocating the endpoint would require both URLs to work simultaneously on a payment path. The route becomes a thin adapter calling a Convex action. Moving it to a Convex HTTP action is deliberately deferred.
- The daily maintenance job becomes a Convex cron: expire vouchers past their expiry, soft-delete stale pending vouchers, and hard-delete Test Vouchers older than thirty days. The Vercel cron entry is removed at cutover.
- A shared helper expresses the "counts as a real, live voucher" predicate (`deletedAt` unset and not `isTest`) so the two conditions are not re-typed at every call site.

### Admin data access

- Production holds roughly one thousand vouchers growing at about fifty per month. At that volume the admin list loads the full filtered set in one reactive query and paginates and searches client-side, preserving the existing page-number UI and true substring matching. No Convex search index and no cursor pagination: both would trade correct `contains` semantics and an accurate page count for scale that is more than a decade away.
- Summary endpoints require a bounded date range, defaulting to the current month, because they read every matching voucher and reduce in memory.

### Test purchases

- Test mode is authorised server-side from session role, unchanged in principle from today.
- The webhook suppresses Facebook Pixel and Google Ads conversion events when the voucher is a Test Voucher. WhatsApp delivery is not suppressed, because message sending is part of what a test purchase verifies.
- Operational and reporting queries exclude Test Vouchers. Redemption by code does not, so the full path remains exercisable.
- The test purchase UI consolidates to a single route under the admin tree. The two existing staff-gated routes and the orphaned duplicate form component are removed.

### Branch and sequencing

- No change of any kind is made to the Prisma schema or the production database.
- Preparatory work happens on a branch cut from `main` and merged into the Convex branch: deleting the orphaned test form component and three legacy components, and extracting a shared Sao Paulo date helper. Behaviour fixes are written once, natively in the Convex code, rather than twice.
- One deliberately throwaway exception may ship to `main`: a guard suppressing conversion events for one-centavo payments, deleted at cutover. It touches code only, never schema or data.
- Convex provisioning is limited to a development deployment. No production deployment, no Vercel environment variables, and no build-command change until cutover.

### Data import

- A standalone script reads Postgres through Prisma and writes through an internal Convex mutation, keyed on `code` so it can be re-run idempotently. It performs the `used` to `redeemed` normalisation, the multiplication to cents, the split of `expires_at` into `visitDate` and `expiresAt`, and the folding of `Referrer` rows into the embedded field. It is written as part of this work and dry-run against the development database, but not executed against production until cutover.

## Testing Decisions

A good test here asserts behaviour a user or an external system could observe: what a query returns for a given role, what a mutation leaves in the database, whether a duplicate webhook delivery changes anything the second time. It does not assert that a particular internal function was called, nor reach into intermediate state.

Two seams. An earlier decision to move *all* tests to `convex-test` is partially walked back here: the pure validator keeps its own seam, for the reason given below.

**The Convex function boundary (primary).** Tests drive public queries, mutations, and actions through `convex-test`'s in-memory backend, exactly as a browser would, with role supplied via identity rather than arguments. Mercado Pago is stubbed at the module boundary; nothing else is. Coverage concentrated on:

- Checkout: price derived from settings not input; duplicate phone rejected; invalid or out-of-window visit dates rejected; concurrent checkouts converging on the same code produce exactly one voucher.
- Payment confirmation idempotency: a repeated webhook delivery for an already-confirmed voucher changes nothing and reports no new conversion; an already-redeemed voucher is not reverted.
- Authorisation: public, staff, and admin functions each reject the roles below them, including with a forged role argument present.
- Test Voucher isolation: a Test Voucher is absent from gate, admin list, and summary results, and present when fetched by code.
- Visit Date integrity: reactivating a voucher changes `expiresAt` and leaves `visitDate` untouched.
- Cron behaviour: expiry transitions, stale pending soft-deletes, and Test Voucher hard-deletes at the thirty-day boundary.

**`validateVoucherPurchase` (retained pure seam).** Kept as a direct unit under test because it has four independent branch families — quantity validity, per-type limits, enable toggles, and the visit-date window including disabled days — that touch no I/O and would otherwise each require a Mercado Pago stub to reach.

Prior art in the repo: `voucher-purchase.test.ts`, `voucher-purchase-intake.test.ts`, and `mercadopago-webhook.test.ts` are node:test suites driving pure cores through injected dependencies. The webhook suite is retained as-is with its `processVoucherPayment` dependency repointed at a Convex mutation, since that route stays in Next.js. The intake suite is superseded by function-boundary tests when its injection seam is collapsed.

## Out of Scope

- Executing the data import against production. Written and dry-run here; run at cutover.
- Creating a Convex production deployment, setting Vercel environment variables, or changing the build command.
- Any modification to `schema.prisma` or the production Postgres database.
- Relocating the Mercado Pago webhook to a Convex HTTP action.
- Replacing the two-shared-password authentication model with per-user accounts or an external identity provider.
- Mercado Pago sandbox test users. R$0,01 real purchases are the chosen mechanism.
- Rollup or materialised aggregate documents for the summary endpoints. Revisit if the bounded-range approach is ever actually exceeded.
- Visual redesign of any screen. Component changes are limited to what removing tRPC and the schema changes require.

## Further Notes

Two live production bugs were found while specifying this and are fixed as part of it rather than separately, since the queries containing them are being rewritten:

- The gate's notion of "today" is computed in server-local time, which is UTC on Vercel, so the operational day currently rolls over at 21:00 Sao Paulo. The cron's timezone conversion parses a Sao Paulo wall-clock string as server-local time, producing a timestamp three hours off.
- Conversion events fire for every approved payment with no test filter, so every R$0,01 test purchase has reported a one-centavo conversion to Facebook and Google.

`staffProcedure` in the current tRPC layer checks `USER_ROLES.includes(role)`, which the type system already guarantees. It is equivalent to the authenticated check it wraps and should not be reproduced.

Glossary terms to add to `CONTEXT.md`: Voucher Code, Redeemed (with `used` named as its retired synonym), Visit Date, Expiry, Site Setting, Test Voucher. The existing Voucher Purchase Intake entry loses its reference to server-owned `valid`.

`docs/04-data-model-and-settings.md` is deleted rather than rewritten; the schema and its validators become the source of truth, per the repository's own rule against documenting what code already states.
