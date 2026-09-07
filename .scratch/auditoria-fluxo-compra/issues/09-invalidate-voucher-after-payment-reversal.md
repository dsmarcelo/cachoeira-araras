# 09: Invalidate Voucher after payment reversal

**What to build:** Prevent entry with a Voucher whose payment was refunded, cancelled, or received a chargeback. The status must appear correctly for customer and admin without deleting purchase history.

**Blocked by:** None (can start immediately; the completed PR 2 already exposes status and image to the customer).

**Status:** ready-for-agent

- [ ] A negative terminal notification moves any Voucher not yet Redeemed to an explicit, non-redeemable reversed-payment state.
- [ ] The gate rejects the Voucher and "Meus Vouchers" does not present it as valid entry nor make a new valid Voucher image available.
- [ ] A Voucher that is already Redeemed remains terminal and receives a visible administrative warning about the subsequent reversal.
- [ ] Repeated notifications remain idempotent and do not erase previous data or events.
- [ ] Tests cover refund, chargeback, and cancellation before and after redemption.
