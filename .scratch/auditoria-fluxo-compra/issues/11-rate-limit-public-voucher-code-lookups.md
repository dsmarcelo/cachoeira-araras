# 11: Rate limit public Voucher Code lookups

**What to build:** Prevent an anonymous client from enumerating Voucher Codes via rapid attempts, while preserving lookup and status updates needed in payment return, "Meus Vouchers", and the gate.

Today, `getByCode` is public, unauthenticated, and completely unthrottled. With 4-character codes in an `a-z0-9` alphabet (only ~1.68 million combinations), an attacker could sweep the keyspace to locate active `valid` vouchers. Since gate access validates entry by code alone, enumeration represents a direct vector for unauthorized entry (partially mitigated by gate staff viewing name and phone in `listToday`).

Rate limiting `getByCode` is the critical first stage (inexpensive, quick mitigation) of the voucher code hardening plan:
- The initial anonymous lookup by Voucher Code passes through rate limiting protection (via `@convex-dev/rate-limiter`).
- Once a client is authorized for a code, monitoring that voucher does not count towards brute-force limits, but arbitrary random sweeps are blocked.
- Direct public queries that bypass limits to test arbitrary codes are closed.
- Legitimate flows (payment return at `/pagamento`, "Meus Vouchers", OG image generation, and gate validation) continue working with necessary reactivity and access.

**Blocked by:** 10: Rate limit checkout creation.

**Status:** ready-for-agent

- [ ] The initial anonymous lookup by Voucher Code consumes shared rate limiter tokens.
- [ ] After an authorized lookup, the client can monitor status updates for that Voucher without being permitted to sweep arbitrary codes.
- [ ] Direct unthrottled public querying for arbitrary codes is eliminated.
- [ ] Payment return, "Meus Vouchers", image generation, and gate validation maintain full reactivity and access.
- [ ] Tests verify rate-limit blocking after threshold exhaustion and uninterrupted status tracking for an authorized voucher.

Implementation notes:
- PR reference: PR 14 (`feat(voucher): novo formato de código de voucher`) — Phase 1: `getByCode` rate limit (Size: S, Impact: High).
- References: `convex/vouchers.ts` (`getByCode`), `convex/lib/voucherCode.ts:7`, `@convex-dev/rate-limiter`.
