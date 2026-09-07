# 13: Run daily maintenance in indexed batches

**What to build:** Keep daily expiration and cleanup working as the Vouchers table grows, querying only relevant records and continuing work in safe batches.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Maintenance finds expired Vouchers via index and does not collect the entire table.
- [ ] When a batch does not complete the work, continuation is scheduled with a cursor or equivalent limit without skipping or repeating effects.
- [ ] Eligible Vouchers expire or are deleted according to current rules, while future and Redeemed Vouchers remain unchanged.
- [ ] Existing tests remain green and new tests exercise more than one batch.
- [ ] A repeated run produces the same final state and does not accumulate unnecessary continuations.
