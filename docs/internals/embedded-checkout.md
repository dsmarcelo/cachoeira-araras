# Embedded checkout (Bricks) payments

Embedded purchases have no Checkout Pro preference: `preferenceId` exists only
on Pro Vouchers, which keep their original confirmation and refund path.
A **Payment Attempt** is one charge request (Pix or card) for a Voucher. Its
status is the provider's view of that charge and never changes the Voucher
status; a rejected or expired attempt does not cancel the purchase. Only the
idempotent confirmation (webhook, reconciliation) makes a Voucher Valid.

Starting a charge is one server transaction. It requires the management token,
a Pending Voucher without Official Payment or cancellation in progress, and no
other attempt in `creating`, `uncertain`, `pending` or `in_process`. The attempt
and its recoverable `createPayment` operation are stored before Mercado Pago is
called, so a repeated `requestId` reuses the same attempt and idempotency key.
Two tabs cannot create two charges.

A timeout or lost response leaves the attempt `uncertain`, blocking any other
charge. Only a definite provider refusal (4xx except 408/409/425/429) marks it
`rejected` and allows a new request.

Pix is payable for 30 minutes (sent with a few seconds of margin, as Mercado
Pago requires at least 30). For a Visit Date equal to today in
America/Sao_Paulo the server refuses a new Pix from 16:30, never lets one
outlive 17:00, and refuses a new card charge from 17:00. Only creation is
limited; later notifications are never refused for their arrival time.

Cards: the Brick tokenizes the card, so the site sees only a single-use token,
never the number or CVV. The charge is the Voucher price; installment interest
(the account's own conditions) never changes the base amount. A 3DS challenge
(`pending` with `challenge`) blocks other charges until the provider settles it.
A decline is explained from the provider's detail code and allows a new request
for the same Voucher and price.

Confirmation verifies the provider payment's base amount equals the Voucher
price and the currency is BRL. Embedded Vouchers require both; Pro Vouchers keep
their existing confirmation. A mismatched embedded approval never releases entry
and follows the Excess Payment refund path.

Payer email and document live only in the operation request, never in public
queries. Private credentials stay in the backend.
