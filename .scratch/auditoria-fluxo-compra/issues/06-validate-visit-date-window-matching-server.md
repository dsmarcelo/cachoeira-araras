# 06: Validate Visit Date window matching server

**What to build:** Make the form apply the same Visit Date window used by Voucher Purchase Intake, rejecting past days and days beyond the limit configured in Site Settings on the client side.

In `src/lib/voucher/types.ts:83`, the `.min()` constraint on `intendedDate` is currently `Date.now() - NEXT_PUBLIC_MAX_INTENDED_DAYS days`. This means the schema accepts dates up to 30 days in the past while enforcing no upper limit in the future — the rule is completely inverted.

While the calendar UI and server-side `validateVisitDate` prevent past dates from reaching the database, the client schema validation is ineffective, and the "max future days" constant (`NEXT_PUBLIC_MAX_INTENDED_DAYS`) is erroneously used as a past minimum.

The fix sets:
- Minimum date: today in the São Paulo timezone.
- Maximum date: today + `max.intended.days`, ideally reading the setting from Convex rather than diverging via a public environment variable.

**Blocked by:** 05: Use São Paulo date keys in calendar.

**Status:** ready-for-agent

- [ ] The minimum validation limit is today in São Paulo, rejecting any past dates.
- [ ] The maximum limit matches the `max.intended.days` setting used by the server, without a diverging public env configuration.
- [ ] Calendar and form validation agree on both ends of the permitted window.
- [ ] The server remains the ultimate authority and rejects any manipulated submission outside the window.

Implementation notes:
- PR reference: PR 7 (`fix(checkout): corrige o limite mínimo de data no schema`) — Size: S, Impact: Medium.
- References: `src/lib/voucher/types.ts:83` (`intendedDate` schema), `NEXT_PUBLIC_MAX_INTENDED_DAYS`, Convex setting `max.intended.days`.
