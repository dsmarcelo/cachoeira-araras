# 07: Checkout

**What to build:** A visitor chooses entry types and a Visit Date, is shown the correct total,
and is sent to Mercado Pago with a Pending Voucher recorded under a short unique code.

The price is derived by the server from current Site Settings, so a stale or tampered browser
cannot change what is charged. The visitor is blocked from a date in the past, beyond the
booking window, or on a disabled day; and stopped at checkout if their phone number already
holds a valid voucher.

One Convex action does the work: derive the price, generate a code, create the Mercado Pago
preference, then call an internal mutation that re-checks code uniqueness and inserts in one
transaction, retrying with a new code on collision. This closes the existing race where the
uniqueness check and the insert were separate calls.

`validateVoucherPurchase` stays a pure function taking input and settings, kept as a direct
unit under test: it has four independent branch families — quantity validity, per-type limits,
enable toggles, and the visit-date window including disabled days — that touch no I/O and
would otherwise each need a Mercado Pago stub to reach. The rest of the intake's
dependency-injection seam, roughly eight function-typed parameters, collapses into the action
and its internal mutation, since its purpose was testability without a database.

**Blocked by:** 01, 05

**Status:** ready-for-agent

- [ ] The total shown matches what the server charges, and a client that sends a different
      price is charged the server's.
- [ ] A past date, a date beyond the booking window, and a disabled day are each refused with
      a reason the visitor can act on.
- [ ] A phone number that already holds a valid voucher is refused at checkout.
- [ ] Quantity limits and per-entry-type toggles from settings are honoured.
- [ ] The generated code is short enough to read aloud at a gate, and unique.
- [ ] Two concurrent checkouts that generate the same code produce exactly one voucher, and
      the loser gets a different code rather than an error.
- [ ] The voucher is left Pending with `visitDate` set to the day the customer chose.
- [ ] Mercado Pago is stubbed at the module boundary in tests; nothing else is stubbed.
