# 11: Rate limit public Voucher Code lookups

**What to build:** Prevent an anonymous client from enumerating Voucher Codes via rapid attempts, while preserving lookup and status updates needed in payment return, "Meus Vouchers", and the gate.

**Blocked by:** 10: Rate limit checkout creation.

**Status:** ready-for-agent

- [ ] The first anonymous lookup by Voucher Code goes through an operation that can consume the shared rate limiter.
- [ ] After an authorized lookup, the client monitors the state of that same Voucher without allowing unlimited queries for different codes.
- [ ] Direct public queries allowing arbitrary code testing no longer bypass the limit.
- [ ] Payment return, "Meus Vouchers", image generation, and gate validation continue working with their current levels of reactivity and access.
- [ ] Tests verify blocking after the limit is exceeded and continuity of lookups for an already authorized Voucher.
