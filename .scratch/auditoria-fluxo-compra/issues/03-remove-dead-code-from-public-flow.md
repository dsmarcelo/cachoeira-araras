# 03: Remove dead code from public flow

**What to build:** Reduce the public purchase flow to the behavior the customer actually uses, removing unreachable UI and legacy fields that are always sent as zero, without removing features still used by admin.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The legacy purchase route preserves only the necessary redirect and contains no unreachable UI.
- [ ] Public validation and submission do not include quantities that the customer cannot select.
- [ ] Public Voucher purchase continues sending only data accepted by Voucher Purchase Intake.
- [ ] Test purchase and the pool Site Setting are retained if they still have administrative consumers; provably orphaned items are removed.
