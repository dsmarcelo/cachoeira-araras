# 14: Postgres to Convex import script

**What to build:** One scripted, re-runnable step that carries the existing production Vouchers
and Site Settings into Convex, so cutover is not a manual data-entry exercise. It reads Postgres
and writes through internal Convex mutations, keyed on Voucher Code for Vouchers and setting key
for Site Settings so running it twice is harmless.

It performs the transformations the new model requires: the legacy `used` status normalised to
`redeemed`, prices multiplied into integer cents, the single conflated `expires_at` column
split into `visitDate` and `expiresAt`, and Referrer rows folded into the embedded field on the
voucher they describe. Site Settings are converted from the legacy EAV columns into their typed
values; price settings are converted from reais to integer cents, and their audit fields are
preserved.

Written and dry-run against the development deployment here. Not executed against production
until cutover — the production database stays untouched, so the migration can be abandoned with
zero consequence.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A full dry-run against the development deployment imports every Voucher and every
      recognised Site Setting.
- [ ] Running it a second time produces no duplicates and no changed data.
- [ ] Legacy `used` vouchers arrive as redeemed; the legacy value appears nowhere in the
      validator.
- [ ] Prices arrive as exact integer cents.
- [ ] `visitDate` and `expiresAt` are both populated from the old single column, and the rule
      used to split them is stated in the script.
- [ ] Referrer rows arrive embedded on their voucher; vouchers without one are valid.
- [ ] Site Settings arrive under the existing key vocabulary with the value selected from the
      legacy EAV column matching its declared type; price settings arrive as integer cents and
      `updatedBy`/`updatedAt` are preserved.
- [ ] An unknown setting key or a value that does not match its declared type fails visibly
      rather than silently falling back to a default.
- [ ] Voucher, Referrer and Site Setting row counts plus a summary of what was written are
      reported at the end.
- [ ] Nothing writes to Postgres.
