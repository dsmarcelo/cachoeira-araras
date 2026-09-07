# 10: Rate limit checkout creation

**What to build:** Protect Voucher Purchase Intake against automated or accidental preference creation, with per-phone limits, a looser global limit, and a ceiling for unexpired Pending Vouchers.

`startCheckout` (`convex/vouchers.ts:113`) is currently a public action without throttling, where every invocation creates a real preference in Mercado Pago.

The only existing barrier is `findActiveByPhone`, which only blocks when a customer phone number already holds a `valid` voucher — pending vouchers are completely unlimited. As observed in the audit, the dev deployment accumulated 56 abandoned pending vouchers.

The solution applies `@convex-dev/rate-limiter` to enforce:
- A rate limit window per phone number.
- A looser global rate limit to protect overall system capacity.
- A ceiling on unexpired pending vouchers per phone number.
- Clear and actionable error feedback in the form when limits are reached, indicating whether to wait or resume an existing pending checkout.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Calls within limits continue creating the preference and Pending Voucher normally.
- [ ] Exceeding the per-phone limit, global rate limit, or pending voucher ceiling prevents creating a new Mercado Pago preference.
- [ ] The checkout form presents clear, actionable feedback when the user must wait or resume a pending purchase.
- [ ] Rate limits are implemented via `@convex-dev/rate-limiter`, avoiding race-prone manual database counters.
- [ ] Tests cover each rate limit threshold and verify that rejected attempts do not persist partial vouchers.

Implementation notes:
- PR reference: PR 12 (`feat(checkout): rate limit em startCheckout`) — Size: M, Impact: High.
- References: `convex/vouchers.ts:113` (`startCheckout`), `@convex-dev/rate-limiter`, `findActiveByPhone`.
