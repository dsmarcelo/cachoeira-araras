# Context

## Domain Vocabulary

### Voucher Purchase Intake

The server-side flow that starts a customer voucher purchase.

It owns the initial purchase rules: validating quantities and intended visit date, deriving the authoritative price from settings, generating the short voucher code, creating the Mercado Pago checkout preference, persisting the pending voucher, and recording optional referrer attribution.

Callers should not provide server-owned voucher state such as `price`, `status`, or `valid`.
