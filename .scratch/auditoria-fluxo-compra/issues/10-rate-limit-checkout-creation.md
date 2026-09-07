# 10: Rate limit checkout creation

**What to build:** Protect Voucher Purchase Intake against automated or accidental preference creation, with per-phone limits, a looser global limit, and a ceiling for unexpired Pending Vouchers.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Calls within limits continue creating the preference and Pending Voucher normally.
- [ ] Exceeding the per-phone limit, global limit, or pending ceiling prevents creating a new preference in Mercado Pago.
- [ ] The form displays a clear, actionable message when the customer needs to wait or resume a pending purchase.
- [ ] Concurrent limits use the Convex rate limiting component, without race-prone counters.
- [ ] Tests cover each limit and verify that a rejected attempt does not persist a partial Voucher.
