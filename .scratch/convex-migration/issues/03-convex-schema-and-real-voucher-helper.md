# 03: Convex schema, dev deployment, and the "counts as real" helper

**What to build:** The Convex data model exists and is the source of truth for the shape of a
Voucher and a Site Setting. Nothing user-facing yet; this is the ground every later slice
stands on, and the one moment the model gets corrected without an in-place migration.

Vouchers carry: Voucher Code as identity, a single `status` union (pending, valid, redeemed,
expired), separate `visitDate` and `expiresAt` fields with one meaning each, an integer
`priceCents`, an optional embedded referrer object, a server-owned `isTest` flag, and
`deletedAt` for soft delete. The `valid` boolean, the autoincrement id, the separate Referrer
table, and the four unused NextAuth tables are not carried forward.

Settings are one document per key, so two admins editing concurrently cannot clobber each
other, with the value typed as a union of the shapes the settings vocabulary actually uses
plus who last changed it. The existing key-to-type map stays the compile-time source of truth.

One shared helper expresses "counts as a real, live voucher" so the soft-delete and Test
Voucher conditions are never re-typed at a call site.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A Convex development deployment is provisioned. No production deployment, no Vercel
      environment variables, no build-command change.
- [ ] Vouchers and settings can be written and read back in every shape the domain uses,
      demonstrated by `convex-test`.
- [ ] `visitDate` and `expiresAt` are independently settable and independently readable.
- [ ] Prices are integers in cents everywhere in the schema.
- [ ] The "counts as a real, live voucher" helper exists and excludes both soft-deleted and
      Test Vouchers.
- [ ] No change to `schema.prisma` or the production Postgres database.
