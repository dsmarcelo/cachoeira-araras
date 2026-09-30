# Embedded checkout (Bricks) payments

Embedded purchases have no Checkout Pro preference: `preferenceId` exists only
on Pro Vouchers, which keep their original confirmation and refund path. A
**Payment Attempt** is one charge request (Pix or card) for a Voucher. Its status
is the provider's view of that charge and never changes the Voucher status; only
the idempotent confirmation (webhook, reconciliation) makes a Voucher Valid.
A saved Pro address is only followed when it is an https Mercado Pago address.

Starting a charge is one server transaction. It requires the management token,
a Pending Voucher without Official Payment or cancellation in progress, and no
other attempt in `creating`, `uncertain`, `pending` or `in_process`. The attempt
and its recoverable `createPayment` operation are stored before Mercado Pago is
called, so a repeated `requestId` reuses the same attempt and idempotency key.
Two tabs cannot create two charges. Renewing, switching and cancelling: see
`embedded-checkout-replacement.md`. A timeout or lost response leaves the
attempt `uncertain`, blocking any other charge; only a definite provider
refusal (4xx except 401/403 and 408/409/425/429) marks it `rejected`. 401/403
are our own credential faults: they stay `uncertain` with a neutral technical
message. Recovery re-runs its own operation (same idempotency key).

Pix is payable for 30 minutes plus a few seconds of margin (Mercado Pago
requires at least 30). For a Visit Date of today (America/Sao_Paulo) no new Pix
is created once it could not live that long before 17:00 (about 16:30), and no
new card charge from 17:00. Late notifications are never refused.

Cards: the Brick tokenizes the card, so the site sees only a single-use token,
never the number or CVV; it is kept only until the operation settles. The
charge is the Voucher price; installment interest never changes the base
amount. A 3DS challenge (`pending` with `challenge`) blocks other charges until
the provider settles it. A decline is explained from the provider's detail code
and allows a new request for the same Voucher and price.

Confirmation of an embedded Voucher requires the provider payment's base
amount to equal the Voucher price and the currency to be BRL; a mismatch never
releases entry and follows the Excess Payment refund path. A late `pending`
update never undoes a recorded approval. Pro Vouchers keep their existing
confirmation. Payer email and document live only in the operation request,
never in public queries.
