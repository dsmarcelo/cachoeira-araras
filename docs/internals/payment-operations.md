# Recoverable Mercado Pago operations

Preference invalidation, payment discovery, cancellation, full refunds and
embedded charge creation (`createPayment`, whose persisted body is resent
unchanged on every retry) record an intent before contacting Mercado Pago. The
owning transaction keeps that intent's identifier and reuses it for retries; a
fresh payment discovery needs a fresh intent because completed results are
snapshots. A charge's single-use card token is dropped once it settles.

Every request carries the intent-derived idempotency key. Refund retries rely on
Mercado Pago's refund idempotency protection. Preference expiry and cancellation
also read provider state to recognize effects whose response was lost. A failed
call leaves the intent unresolved; retrying reconciles it, and a concurrent
failure cannot overwrite a recorded success. These primitives never schedule
work or change Voucher state.

An operation result records what the provider returned. A refund response is not
proof of completed reimbursement unless its status confirms approval; likewise,
cancellation can return an approved payment when approval won the race. Payment
discovery has no date or status restriction, reads up to 1,000 payments and
fails instead of returning a partial result. Provider errors are never
interpreted as an empty payment history.

Opening My Vouchers or the admin voucher table checks pending purchases against
Mercado Pago when an authorized caller is present, at most once per voucher per
minute, reusing an unresolved discovery intent after failure. An approved
payment enters the same idempotent confirmation path as the webhook.

Refund rejection errors stop automatic attempts and require staff review; rate
limiting remains retryable and other failures stop after five attempts per retry
cycle. Resuming a held refund reuses its original operation and idempotency key.
An admin retry first checks the provider's payment, ownership, amount and
refunded total: a full prior refund is recorded as completed without another
request; a partial refund or mismatch blocks it for manual investigation.

Admins can request a full refund for a voucher's official payment. The backend
checks the provider's payment ID, voucher reference, amount and refund state
before queuing it. Confirmation invalidates an unused voucher; a redeemed
voucher retains its redemption and records a reversal warning.
