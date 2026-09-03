# 06: Public voucher status lookup by code

**What to build:** A visitor types their Voucher Code, without logging in, and sees that
voucher's real state — so they can confirm it before travelling.

Small by design. It establishes the shape of a public Convex query and pins down the rule
that lookup by code is the one path that does not hide Test Vouchers, so the full
purchase-to-entry path stays exercisable.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Entering a valid code with no session returns that voucher's status.
- [ ] Entering an unknown code reports not-found rather than erroring.
- [ ] A soft-deleted voucher is not returned.
- [ ] A Test Voucher is returned when fetched by its code.
- [ ] The response carries nothing a stranger holding a guessed code should not see.
