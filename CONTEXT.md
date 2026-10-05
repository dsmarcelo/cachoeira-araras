# Cachoeira das Araras

Cachoeira das Araras sells dated entry vouchers online and validates them at the gate.
This is a single domain context. Use these terms throughout the project.

- **Voucher**: entry for a named party, with quantities, a Visit Date and a payment history.
- **Voucher Code**: the short public reference used by visitors, staff and the payment provider. A code is not permission to manage a purchase.
- **Visit Date**: the São Paulo calendar day chosen at purchase. Staff reactivation does not change it.
- **Expiry**: the instant after which an unused Voucher is overdue. Separate from Visit Date.
- **Pending / Valid / Redeemed / Expired / Cancelled / Refunded**: respectively awaiting approval, available for entry, entry recorded, overdue, abandoned before approval, and payment reversed before entry (see Refunded below).
- **Refunded**: a Voucher whose payment was returned before entry. A refund or cancellation is permanent. A reversal caused by a lost chargeback is the one that can revert (to Valid, or Expired if past Expiry) if the case is later won or the payment is approved again, since the money stayed with the seller. A redeemed or expired Voucher keeps its status and records the reversal, which removes its revenue.
- **Official Payment**: the first approved payment accepted for a Voucher.
- **Excess Payment**: another approved payment, or an approval after cancellation; refunded without granting another entry.
- **Payment Dispute**: a mediation or an undecided chargeback on the Official Payment. The Voucher stays usable and staff see a warning; it is reversed only if the chargeback is lost.
- **Partial Refund**: part of the Official Payment was returned. The Voucher is unchanged and staff see a flag with the returned amount.
- **Payment Refund**: tracked reimbursement, complete only after provider confirmation.
- **Test Voucher**: staff purchase at R$ 0.01, redeemable by code but excluded from operational lists, revenue and advertising conversions.
- **Referrer**: purchase attribution captured with the Voucher.
- **Site Setting**: administrator-controlled availability, quantity limits, booking window or visitor messaging. Prices come from deployment configuration.

See [product rules](docs/product/vouchers.md), [integrity rules](docs/internals/payment-operations.md) and [architecture decisions](docs/adr/).
