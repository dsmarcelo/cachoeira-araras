# Payment recovery and maintenance

## Paid purchase still Pending

1. Match the Voucher Code, payment identifier and selected Mercado Pago account. Inspect the provider's actual payment state rather than the browser return URL.
2. Check webhook signature configuration and that frontend/backend service secrets match. Use provider and Convex logs to distinguish notification failure from rejected confirmation.
3. Open the purchase through its authorized saved access or the administrator table to trigger Pending reconciliation. Checks are throttled to once per minute per Voucher.
4. Investigate unresolved operation intents or mismatched ownership/amounts. Do not manually mark a Voucher paid to hide a provider failure.

## Refund held or overdue

Review the payment and refund records in the administrator UI. Check provider ownership, charged amount and already refunded total before retrying. The administrator retry preserves the original idempotency key. Partial refunds, mismatches and provider rejections require investigation rather than a fresh refund request.

The refund sweep runs every 15 minutes. A queued or returned refund request is not proof of reimbursement; verify provider confirmation. Preserve redemption history when a reversal follows entry.

## Scheduled maintenance and financial repair

Voucher maintenance runs at 03:00 UTC, midnight São Paulo under the current UTC−3 offset. It expires overdue Valid Vouchers, hides overdue Pending ones and deletes Test Vouchers older than 30 days. Work continues in batches until complete. Check scheduled execution failures if overdue records remain visible.

Finance recomputation runs at 03:15 UTC for the last seven days. For missing or stale older totals, run `pnpm exec convex run finance:rebuildAll` on the selected deployment, adding `--prod` only for an intentional production repair. Wait for scheduled batches to finish and compare totals with qualifying Vouchers. Imports require the backfill first; see the [import runbook](postgres-to-convex-cutover.md).

Where Sentry is configured, filter payment events by provider and flow step, then correlate payment identifiers with backend logs. Keep buyer details, tokens and signatures out of incident reports and monitoring payloads.
