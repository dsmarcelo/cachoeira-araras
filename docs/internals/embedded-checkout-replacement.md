# Replacing a charge and cancelling (embedded checkout)

Complements `embedded-checkout.md`. Closing a charge never changes the Voucher
(status, Visit Date and Expiry stay; the phone's Pending purchase stays taken).
Only cancelling the purchase is a separate, explicit action.

**One open charge.** A new Pix or card request first closes the previous
attempt at the provider (a recorded `cancel` operation, shared by every tab and
retry through the attempt). Only after the provider confirms the end is the new
charge created. Page clocks never count: an expired Pix stays `pending` until
the provider confirms it ended. A failure to check or close keeps the result
uncertain and blocks the replacement. A charge in review (`in_process`) is not
closed on the buyer's behalf; the new request is refused while it lasts.

**Lost create request.** An `uncertain` attempt with no payment is recovered
by re-running its own operation (same idempotency key). If that made a charge,
it is closed like any other; a definite refusal (for example a Pix deadline
already past) settles it as `rejected`. If the provider keeps failing it keeps
blocking, and the buyer can retry the check.

**Approval wins.** An approval found while closing or cancelling confirms the
Voucher as paid and starts no other charge. An approved attempt whose Voucher
is not yet confirmed never allows another charge.

**Cancelling the purchase.** Needs the management token and the buyer's explicit
confirmation. It first recovers an unknown charge and refuses to finish while
the result is still unknown; then it cancels every open charge, and the
attempts end as `cancelled`. An approval arriving after `Cancelled` follows
the existing full Payment Refund; the page says it will be refunded. Pro
Vouchers keep their previous cancellation and refund path.

Late notifications of a replaced charge are matched by payment id: they never
create another Official Payment, and a second approval is an Excess Payment.
