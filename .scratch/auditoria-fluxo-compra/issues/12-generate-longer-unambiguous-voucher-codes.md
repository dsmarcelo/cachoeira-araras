# 12: Generate longer Voucher Codes without ambiguous characters

**What to build:** Issue new six-character Voucher Codes using a Crockford alphabet free of easily confused characters and uniform selection, without invalidating four-character codes already delivered to customers.

**Blocked by:** 11: Rate limit public Voucher Code lookups.

**Status:** ready-for-agent

- [ ] Every new normal or test purchase receives a six-character Voucher Code in the new alphabet.
- [ ] Generation does not use modulo bias and retains existing collision retry.
- [ ] Legacy Voucher Codes remain accepted in lookup, payment return, image, admin, and gate indefinitely.
- [ ] Customer inputs tolerate casing differences expected by the format without silently transforming ambiguous characters.
- [ ] Tests cover alphabet, length, backward compatibility with legacy codes, and collision retry.
