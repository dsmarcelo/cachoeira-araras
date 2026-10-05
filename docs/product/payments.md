# Payments and reporting

Mercado Pago processes payment. Returning from checkout does not by itself prove payment approval. The Voucher becomes available when the provider's approved payment is confirmed.

One Official Payment grants entry. Extra approved payments are returned in full and never grant additional entry. Refunds remain in progress until Mercado Pago confirms reimbursement. A failed refund can require administrator review.

Administrators can request a full refund of the Official Payment. A confirmed reversal removes availability from an unused Voucher. If entry was already recorded, the redemption remains visible with a reversal warning.

Money can also return to a customer outside the app: a refund or cancellation in the Mercado Pago panel, a mediation, a card chargeback, or a partial refund. Mercado Pago is re-checked when a Voucher is viewed (Meus Vouchers, the admin list, gate lookup, at most once per minute per Voucher) and once a day for recently changed payments, so these events are picked up even if no notification arrived.

- A payment in dispute (mediation or a chargeback not yet decided) keeps the Voucher usable. Administrators and gate staff see a warning; customers see no change. The revenue still counts until the dispute is lost.
- A lost chargeback, a refund or a cancellation removes availability from an unused Voucher, and removes the revenue of one already used or expired. Refunds and cancellations are final. A lost chargeback is reversed if the dispute is later won, which restores the Voucher (as Expired if its Expiry has passed) and its revenue.
- A partial refund leaves the Voucher unchanged and is flagged for staff with the returned amount.
- At the gate, redemption waits for the check. If Mercado Pago cannot answer, staff see a notice and may still admit the visitor based on the last known state. Staff cannot reactivate a refunded Voucher.
- Administrators can filter the Voucher list by payment issue and see the provider status, date and refunded amount on each Voucher.

Financial reports group revenue by purchase day in São Paulo, not Visit Date or payment approval day. They count real, visible Vouchers with an Official Payment in Valid, Redeemed or Expired state and no reversal. Test, Pending, Cancelled, Refunded and hidden Vouchers contribute no revenue. Reported totals sum Voucher prices; they are not a statement of provider fees or bank settlement.

Employees handle gate lookup, redemption, reactivation and test purchases. Administrators additionally manage accounts, business settings, payment review and refunds. Public account registration is disabled.
