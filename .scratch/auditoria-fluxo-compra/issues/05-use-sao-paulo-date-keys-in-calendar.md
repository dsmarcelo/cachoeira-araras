# 05: Use São Paulo date keys in calendar

**What to build:** Make the purchase calendar compare Visit Dates as São Paulo days, without depending on device local time or converting local midnight to a different day in UTC.

The disabled date calculation in `src/app/_components/voucher-form.tsx:351` is currently fragile:
1. `getBrazilianDate` (`src/lib/utils/date.ts:1`) builds an artificial date via `toLocaleString` whose local clock time mimics São Paulo. The trick `yesterday = today - 1 day` only blocks past dates because the `Date` instance carries hours; if zeroed out, yesterday would be accepted.
2. In `src/app/_components/voucher-form.tsx:363`, `date.toISOString().slice(0, 10)` is used to match against `disabled.days`. Because this normalizes to UTC, for a visitor located in a timezone east of Greenwich, local midnight converts to the previous calendar day in UTC, shifting disabled days by one day.

The fix is to use `getSaoPauloDateKey` (which already exists and is used by the server) and compare `YYYY-MM-DD` strings directly on the client, eliminating `getBrazilianDate` from the calendar path.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Dates earlier than today are blocked using the São Paulo date key.
- [ ] Closed / disabled days are compared as `YYYY-MM-DD` strings and remain correct in timezones east and west of Greenwich.
- [ ] The calendar eliminates `getBrazilianDate` and does not rely on creating artificial Date objects mimicking local hours.
- [ ] Focused tests cover at least one timezone where conversion to UTC would shift the date.

Implementation notes:
- PR reference: PR 10 (`fix(date): usa a chave de data São Paulo no cliente`) — Size: M, Impact: Medium.
- References: `src/app/_components/voucher-form.tsx:351, 363`, `src/lib/utils/date.ts:1` (`getBrazilianDate`), `getSaoPauloDateKey`.
