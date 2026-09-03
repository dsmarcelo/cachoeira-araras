# 15: Postgres to Convex import script

**What to build:** One scripted, re-runnable step that carries the existing production data
into Convex, so cutover is not a manual data-entry exercise. It reads Postgres and writes
through an internal Convex mutation, keyed on Voucher Code so running it twice is harmless.

It performs the transformations the new model requires: the legacy `used` status normalised to
`redeemed`, prices multiplied into integer cents, the single conflated `expires_at` column
split into `visitDate` and `expiresAt`, and Referrer rows folded into the embedded field on the
voucher they describe.

Written and dry-run against the development deployment here. Not executed against production
until cutover — the production database stays untouched, so the migration can be abandoned with
zero consequence.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A full dry-run against the development deployment imports every voucher.
- [ ] Running it a second time produces no duplicates and no changed data.
- [ ] Legacy `used` vouchers arrive as redeemed; the legacy value appears nowhere in the
      validator.
- [ ] Prices arrive as exact integer cents.
- [ ] `visitDate` and `expiresAt` are both populated from the old single column, and the rule
      used to split them is stated in the script.
- [ ] Referrer rows arrive embedded on their voucher; vouchers without one are valid.
- [ ] Row counts and a summary of what was written are reported at the end.
- [ ] Nothing writes to Postgres.
