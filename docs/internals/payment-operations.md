# Recoverable Mercado Pago operations

Preference invalidation, payment discovery, cancellation and full refunds record
an immutable intent before contacting Mercado Pago. The owning transaction keeps
that intent's identifier and reuses it for retries; a fresh payment discovery
needs a fresh intent because completed results are snapshots.

Every request carries the intent-derived idempotency key. Refund retries rely on
Mercado Pago's refund idempotency protection. Preference expiry and cancellation
also read provider state to recognize effects whose response was lost.

A failed or interrupted call leaves the intent unresolved. Retrying reconciles
it; a concurrent failure cannot overwrite a recorded success. These internal
primitives do not schedule work or change Voucher state by themselves.

An operation result records what the provider returned. A refund response is not
proof of completed reimbursement unless its status confirms approval. Likewise,
cancellation can return an approved payment when approval won the race.

Payment discovery has no date or status restriction, reads up to 1,000 payments,
and fails instead of returning a partial result when the scan is incomplete.
Provider errors are never interpreted as an empty payment history.
