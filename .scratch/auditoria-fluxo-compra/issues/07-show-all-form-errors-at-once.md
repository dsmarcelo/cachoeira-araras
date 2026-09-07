# 07: Show all form errors at once

**What to build:** Show the customer all known form issues on the first submit attempt, so that name, phone, Visit Date, and quantities can be corrected in a single pass.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The phone error appears even when other basic fields are also invalid.
- [ ] An empty submission simultaneously displays errors for all applicable required fields.
- [ ] Phone validation rules continue accepting and rejecting the same formats defined for purchase.
- [ ] Focused tests cover multiple simultaneous errors without testing internal details of the validation library.
