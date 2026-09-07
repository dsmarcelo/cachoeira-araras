# 13: Run daily maintenance in indexed batches

**What to build:** Keep daily expiration and cleanup working as the Vouchers table grows, querying only relevant records and continuing work in safe batches.

In `convex/maintenance.ts:31`, `runDailyMaintenance` performs `ctx.db.query("vouchers").collect()` — scanning the entire `vouchers` table within a single mutation.

While this executes fine with ~101 documents currently in the table, it will breach Convex document read limits as database size grows. The failure mode is insidious: the cron job fails silently, and vouchers stop expiring without surfacing any user-facing errors.

The fix introduces:
- A database index on `expiresAt` (and/or `status`) so maintenance queries scan only overdue vouchers instead of full-table scans.
- Batch pagination with scheduled continuation using cursors or equivalent limits so large backlogs are processed safely across execution boundaries without skipping or duplicating effects.
- Future and already `redeemed` vouchers remain untouched.
- Existing tests in `convex/maintenance.test.ts` must stay green, with new tests verifying multi-batch progression and idempotency on repeat runs.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Maintenance discovers expired Vouchers via index query, completely eliminating full table scans.
- [ ] Incomplete batches schedule continuation via cursor or equivalent limit without skipping or duplicating side-effects.
- [ ] Eligible vouchers expire or are cleaned up per current business rules, while future and Redeemed vouchers remain unchanged.
- [ ] Existing tests in `convex/maintenance.test.ts` remain green, and new tests verify multi-batch processing.
- [ ] Repeated executions produce an identical final state without accumulating unnecessary scheduled continuations.

Implementation notes:
- PR reference: PR 13 (`perf(maintenance): manutenção diária sem full table scan`) — Size: M/L, Impact: High (prevents future silent cron failures).
- References: `convex/maintenance.ts:31` (`runDailyMaintenance`), `convex/maintenance.test.ts`, `convex/schema.ts` (index on `expiresAt` / `status`).
