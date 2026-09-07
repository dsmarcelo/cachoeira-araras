# 05: Use São Paulo date keys in calendar

**What to build:** Make the purchase calendar compare Visit Dates as São Paulo days, without depending on device local time or converting local midnight to a different day in UTC.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Dates earlier than today are blocked using the São Paulo date key.
- [ ] Closed days are compared as `YYYY-MM-DD` and remain correct in timezones east and west of Greenwich.
- [ ] The calendar does not depend on creating an artificial date whose local time mimics São Paulo.
- [ ] Focused tests cover at least one timezone where conversion to UTC would shift the day.
