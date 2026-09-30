# Payment integrity

The Next.js webhook verifies Mercado Pago's signature and fetches the payment from the provider. A shared service secret authenticates its call into Convex. Production requires the signing secret; legacy IPN notifications are rejected. Browser return parameters cannot authorize payment approval.

Each provider payment identifier is recorded individually. Repeated delivery of the same payment status is idempotent. Transactional confirmation selects one Official Payment; concurrent approvals cannot grant two entries. Excess approvals and approvals after cancellation queue full refunds without changing entitlement. Reversals preserve a recorded redemption and remove its revenue contribution.

Preference invalidation, discovery, cancellation and refunds persist an immutable operation intent before provider calls. Retries reuse the intent and its idempotency key. Completed discovery is a snapshot; a later discovery needs a fresh intent. Failed calls remain unresolved, and a concurrent failure cannot overwrite success.

A provider response alone is not proof of reimbursement: approval must be confirmed. Cancellation may discover an approved payment if approval won the race. Discovery scans up to 1,000 payments without date or status restrictions and fails if results are incomplete; errors never mean an empty history.

Authorized Pending purchase reads reconcile with the provider at most once per Voucher per minute. Discovered approvals use the same confirmation path as webhooks. Marketing failures do not block payment confirmation, and Test Vouchers produce no conversion event.

Provider rejection stops automatic refund attempts for staff review; rate limiting remains retryable. Other failures stop after five attempts per retry cycle. A resumed refund reuses the original intent. Before an administrator retry, provider payment identity, Voucher ownership, amount and refunded total are checked. An already completed full refund is recorded without another request; partial refunds and mismatches require investigation.
