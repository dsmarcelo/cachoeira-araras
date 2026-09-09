The implementation is close, but the full spec and issues #92–#100 should not yet be considered satisfied. The core architecture is present and tests are green, but several financial and lifecycle guarantees remain incorrect.

## Spec findings

- **High — Refund completion is accepted too early.** The adapter accepts any non-empty refund status and amount, while `attemptRefund` ignores the returned values and immediately marks the refund completed. A pending or partial provider response could therefore produce a false success notice. See [mercadopagoOperations.ts](/home/celoy/code/cachoeira-araras/convex/lib/mercadopagoOperations.ts:32) and [refunds.ts](/home/celoy/code/cachoeira-araras/convex/refunds.ts:178). This violates the requirement that completion only be recorded after Mercado Pago confirms the integral refund.

- **High — An approval discovered during cancellation can lose when it must win.** `cancelPayment` can discover that a payment became approved during its provider re-read, but `cancelPendingPurchase` discards that result and proceeds to mark the Voucher `cancelled`. The tests cover webhook/database ordering, but not this provider-status race. See [mercadopagoOperations.ts](/home/celoy/code/cachoeira-araras/convex/lib/mercadopagoOperations.ts:136) and [vouchers.ts](/home/celoy/code/cachoeira-araras/convex/vouchers.ts:750).

- **High — “Meus vouchers” bypasses the server-side resume check.** The dialog correctly calls `resumePayment`, but the Voucher card still links directly to the locally stored Mercado Pago URL. A stale link can therefore be opened after payment or cancellation. See [page.tsx](/home/celoy/code/cachoeira-araras/src/app/(client)/meus-vouchers/page.tsx:165). This directly contradicts story 14 and issue #96’s “server re-checks on every resume.”

- **High — `Cancelled` is not completely terminal.** The dedicated `reactivate` operation rejects cancelled Vouchers, but the generic admin `updateStatus` operation can still change one directly back to `valid`. See [vouchers.ts](/home/celoy/code/cachoeira-araras/convex/vouchers.ts:1968).

- **Medium — The persisted refund amount is not the observed payment amount.** The webhook only forwards payment ID and status; an Excess Payment’s `amountCents` is populated from `voucher.priceCents`. If the actual charge differs, the audit record is wrong, even though the provider request itself asks for a full refund. See [mercadopago-webhook.ts](/home/celoy/code/cachoeira-araras/src/server/mercadopago-webhook.ts:218) and [vouchers.ts](/home/celoy/code/cachoeira-araras/convex/vouchers.ts:1622).

- **Medium — Refund status exposes unnecessary financial identifiers publicly.** `getRefundNoticesForVouchers` accepts only Voucher Codes and returns Mercado Pago payment IDs and refund amounts without requiring the browser capability. The UI does not need the payment ID. See [refunds.ts](/home/celoy/code/cachoeira-araras/convex/refunds.ts:244).

- **Medium — Operator alerting is only a database record.** Repeated failures insert `operationalAlerts`, but no admin query, UI, logger, Sentry capture, or notification consumes it. The first failure is also caught and silently persisted rather than entering technical monitoring. This does not fulfill stories 36–37 in operational terms.

- **Medium — Browser retention is based partly on page views, not financial events.** Every visit to “Meus vouchers” touches any non-pending Voucher with `Date.now()`, continuously extending retention. Conversely, if a refund begins while the visitor is away, an older local entry can be pruned before the refund query runs. See [page.tsx](/home/celoy/code/cachoeira-araras/src/app/(client)/meus-vouchers/page.tsx:94).

- **Testing decision incomplete.** The spec explicitly requests component/UI tests for dialog privacy/actions, confirmation, refund notices, dismissal, and removal blocking. The added tests cover backend responses and storage helpers, but there are no actual component tests.

## Issue verdict

| Issue | Implementation verdict | Main note |
|---|---|---|
| #92 | Satisfied | Adapter operations, idempotent intents, fake behavior |
| #93 | Satisfied | Multiple Vouchers, atomic one-pending restriction |
| #94 | Satisfied | Individual payments and atomic Official Payment |
| #95 | Mostly satisfied | Capability/privacy flow exists; UI test requirement missing |
| #96 | **Partial** | Direct-link bypass in “Meus vouchers” |
| #97 | **Not satisfied** | Refund confirmation, audit amount, and alert delivery |
| #98 | **Not satisfied** | Provider approval race; terminal admin override |
| #99 | Mostly satisfied | User-facing states exist; public query leaks identifiers and UI tests are missing |
| #100 | **Partial** | Retention integration tracks page access as an event and can miss unseen refunds |

## Standards

There are also implementation-quality risks worth addressing before merging:

- The refund recovery cron performs unbounded collections and filters in memory instead of using the existing status/time index. At scale, it could exceed Convex transaction or scheduling limits and strand refunds: [refunds.ts](/home/celoy/code/cachoeira-araras/convex/refunds.ts:215).
- `getPendingConflict` uses `Date.now()` in a reactive query, but Convex queries do not rerun merely because time passes. Expiration-derived conflict state can become stale: [vouchers.ts](/home/celoy/code/cachoeira-araras/convex/vouchers.ts:216).
- The public refund query accepts an unbounded array of codes and runs multiple database queries per code.
- The pending-purchase dialog can render raw backend/provider error messages instead of consistently translating them into customer-safe text.

Verification performed:

- 26 test files passed
- 229/229 tests passed
- TypeScript passed
- ESLint passed with 0 errors and 11 warnings
- PRs #105–#109 are mergeable and have successful Vercel checks

Tracker-wise, only issues #92 and #93 are currently closed. Issues #94–#100 remain open; PRs #105–#109 are also still open. Even ignoring tracker housekeeping, the implementation blockers above mean the [spec](/home/celoy/code/cachoeira-araras/.scratch/multiplos-vouchers/spec.md:1) is not ready to be declared complete.

Summary: **9 spec findings, 4 standards findings; the worst risks are false refund completion and an approved payment losing the cancellation race.**
