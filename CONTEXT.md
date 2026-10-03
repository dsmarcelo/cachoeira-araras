# Cachoeira das Araras

Cachoeira das Araras sells dated entry vouchers online and validates them at the gate.
This is a single domain context. Use these terms throughout the project.

- **Voucher**: entry for a named party, with quantities, a Visit Date and a payment history.
- **Voucher Code**: the short public reference used by visitors, staff and the payment provider. A code is not permission to manage a purchase.
- **Visit Date**: the São Paulo calendar day chosen at purchase. Staff reactivation does not change it.
- **Expiry**: the instant after which an unused Voucher is overdue. Separate from Visit Date.
- **Pending / Valid / Redeemed / Expired / Cancelled / Refunded**: respectively awaiting approval, available for entry, entry recorded, overdue, abandoned before approval, and payment reversed before entry.
- **Official Payment**: the first approved payment accepted for a Voucher.
- **Excess Payment**: another approved payment, or an approval after cancellation; refunded without granting another entry.
- **Payment Refund**: tracked reimbursement, complete only after provider confirmation.
- **Test Voucher**: staff purchase at R$ 0.01, redeemable by code but excluded from operational lists, revenue and advertising conversions.
- **Referrer**: purchase attribution captured with the Voucher.
- **Site Setting**: administrator-controlled availability, quantity limits, booking window or visitor messaging. Prices come from deployment configuration.

See [product rules](docs/product/vouchers.md), [integrity rules](docs/internals/payment-operations.md) and [architecture decisions](docs/adr/).
