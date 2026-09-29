# Finance summaries

The admin financial report reads `financeDays`, not vouchers. One document per
Sao Paulo purchase day (`purchasedAt`), holding net cents, voucher count, a
24-hour breakdown, and totals by referrer and payment method. A day without
revenue has no document.

## Rules

- **Derived and recomputable.** Vouchers are the source of truth. Any day can be
  rebuilt from them (`finance.recomputeDay`); never edit `financeDays` by hand.
- **What counts** is defined once in `countsTowardRevenue`
  (`convex/lib/financeSummary.ts`): real voucher, approved payment, status
  valid/redeemed/expired, no reversal.
- **One write point.** Every patch of a voucher goes through `patchVoucher`
  (`convex/lib/voucherWrites.ts`). When the patch changes the voucher's revenue
  contribution it schedules `recomputeDay` for the old and new purchase day.
  Scheduled, not inline, so payment mutations stay small and conflict-free.
  There must be no direct `ctx.db.patch` on a voucher elsewhere.
- **Bulk inserts** (`convex/import.ts`) and backfills do not schedule recomputes.
- **Safety net.** A daily cron recomputes the last 7 days.

## Operations

After the first deploy of this table, and after any bulk import:

1. `npx convex run migrations:backfillVoucherPurchasedAtAndSearchText`
   (vouchers without `purchasedAt` are invisible to the summaries).
2. `npx convex run finance:rebuildAll` (walks every day from the earliest
   purchase to today in batches and removes stale summaries).
