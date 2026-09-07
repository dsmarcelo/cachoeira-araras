# 06: Validate Visit Date window matching server

**What to build:** Make the form apply the same Visit Date window used by Voucher Purchase Intake, rejecting past days and days beyond the limit configured in Site Settings on the client side.

**Blocked by:** 05: Use São Paulo date keys in calendar.

**Status:** ready-for-agent

- [ ] The minimum validation limit is today in São Paulo, without accepting days in the past.
- [ ] The maximum limit comes from the Site Setting used by the server, without a second diverging public configuration.
- [ ] Calendar and form validation agree on both ends of the allowed window.
- [ ] The server remains the authority and rejects a manipulated submission outside the window.
