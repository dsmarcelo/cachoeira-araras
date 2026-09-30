# Embedded checkout (Bricks) payments

Purchases started on the embedded checkout have no Checkout Pro preference. Pro
and embedded Vouchers coexist: `preferenceId` is present only on Pro Vouchers,
which keep their original address, confirmation, cancellation and refund path.

A **Payment Attempt** is one charge request for a Voucher. Its status is the
provider's view of that charge and never changes the Voucher status by itself;
a rejected or expired attempt does not cancel the purchase. Only the idempotent
confirmation (webhook, reconciliation) makes a Voucher Valid.

Starting a charge is one server transaction. It requires the management token,
a Pending Voucher without Official Payment or cancellation in progress, and no
other attempt in `creating`, `uncertain`, `pending` or `in_process`. It stores
the attempt and its recoverable `createPayment` operation before Mercado Pago is
called, so a repeated `requestId` reuses the same attempt and provider
idempotency key. Two tabs cannot create two charges.

A timeout or lost response leaves the attempt `uncertain`, which blocks any
other charge. Only a definite provider refusal (4xx other than 408/409/425/429)
marks it `rejected` and allows a new request. Replacing an expired or uncertain
charge after checking the provider belongs to later work.

Pix is payable for 30 minutes (sent with a few seconds of margin because
Mercado Pago requires at least 30). For a Visit Date equal to today in
America/Sao_Paulo the server refuses a new Pix from 16:30 and never lets one
outlive 17:00. Later dates have no extra limit. The Pix deadline is independent
of the Voucher's Visit Date and Expiry.

Confirmation verifies the provider payment's base amount equals the Voucher
price and the currency is BRL (installment interest is not the base amount).
Embedded Vouchers require both; Pro Vouchers check what the notification
carries. A mismatched approval never releases entry and follows the Excess
Payment refund path. A late pending update never undoes a recorded approval.

The payer's email and document live only in the operation request, never in
public queries. Private credentials stay in the backend; the browser receives
only the public key.
