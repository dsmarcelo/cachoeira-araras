# 12: Generate longer Voucher Codes without ambiguous characters

**What to build:** Issue new six-character Voucher Codes using a Crockford alphabet free of easily confused characters and uniform selection, without invalidating four-character codes already delivered to customers.

Three distinct problems exist in the current voucher code generator (`convex/lib/voucherCode.ts:7`):
1. **Enumerability:** A 4-character code in `a-z0-9` yields only 1.68M combinations.
2. **Modulo bias:** `byte % 36` applied to random bytes (0–255) is not uniform (256 mod 36 = 4), causing characters `a` through `d` to appear with higher probability.
3. **Ambiguous characters:** Confusing character pairs such as `0/o`, `1/l`, `i/j` cause friction when codes are read aloud or manually keyed in at gate check-in.

The solution:
- Switch to an unambiguous Crockford base32 alphabet and expand length to 6 characters, growing the keyspace to ~1 billion combinations.
- Ensure uniform random byte selection without modulo bias.
- Support seamless backward compatibility: legacy 4-character codes remain valid and accepted indefinitely across lookups, payment return, OG image rendering, admin, and gate check-in.
- Preserve collision retry logic.
- Accommodate casing variations in user input without silently distorting characters.

**Blocked by:** 11: Rate limit public Voucher Code lookups.

**Status:** ready-for-agent

- [ ] Every new purchase (normal or test) generates a six-character Voucher Code using the Crockford base32 alphabet.
- [ ] Code generation eliminates modulo bias and preserves existing collision retry logic.
- [ ] Legacy four-character codes remain accepted indefinitely in lookups, payment return, image generation, admin, and gate check-in.
- [ ] Client input handling accommodates case-insensitivity without ambiguous character auto-mangling.
- [ ] Tests verify alphabet distribution, code length, backward compatibility with legacy codes, and collision retry behavior.

Implementation notes:
- PR reference: PR 14 (`feat(voucher): novo formato de código de voucher`) — Phase 2: Code format and migration (Size: L, Impact: High).
- References: `convex/lib/voucherCode.ts:7`, Crockford base32 alphabet, collision retry in `convex/vouchers.ts`.
