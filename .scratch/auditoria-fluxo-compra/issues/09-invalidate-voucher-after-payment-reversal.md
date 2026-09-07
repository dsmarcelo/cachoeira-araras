# 09: Invalidate Voucher after payment reversal

**What to build:** Prevent entry with a Voucher whose payment was refunded, cancelled, or received a chargeback. The status must appear correctly for customer and admin without deleting purchase history.

In `convex/vouchers.ts:478`, if a voucher is already in `valid` status and Mercado Pago later sends a webhook notification with `refunded`, `charged_back`, or `cancelled`, `confirmPayment` currently returns `already_processed` and takes no action. This leaves the voucher redeemable at the gate even after payment has been reversed.

The fix handles negative terminal statuses prior to the `already_processed` short-circuit:
- Transition unredeemed valid vouchers from `valid` to an explicit non-redeemable reversed state (e.g. `refunded`).
- Rule for already `redeemed` vouchers: do not revert the redemption, but generate a visible administrative warning for staff.
- Update "Meus Vouchers" and the Vercel OG route (`/api/og`) to reflect the reversed state and prevent rendering or downloading a valid ticket image.
- Add tests in `convex/vouchers.confirmPayment.test.ts` (which already has test harness scaffolding) covering refund, chargeback, and cancellation both before and after redemption.

**Blocked by:** None (can start immediately; the completed PR 2 already exposes status and image to the customer).

**Status:** ready-for-agent

- [ ] A negative terminal notification (`refunded`, `charged_back`, `cancelled`) transitions any unredeemed Voucher out of `valid` to an explicit non-redeemable state before `already_processed` returns.
- [ ] Gate validation rejects the Voucher, and "Meus Vouchers" / `/api/og` do not present it as valid entry nor render a valid entry image.
- [ ] An already `redeemed` Voucher remains terminal and receives a visible administrative warning about the subsequent reversal.
- [ ] Repeated notifications remain idempotent and do not overwrite previous data or audit events.
- [ ] Comprehensive tests in `convex/vouchers.confirmPayment.test.ts` verify refund, chargeback, and cancellation handling before and after redemption.

Implementation notes:
- PR reference: PR 11 (`fix(payment): estorno e chargeback invalidam o voucher`) — Size: M, Impact: High.
- References: `convex/vouchers.ts:478` (`confirmPayment`), `convex/vouchers.confirmPayment.test.ts`, `src/app/api/og/route.tsx`, `src/app/(client)/meus-vouchers`.
