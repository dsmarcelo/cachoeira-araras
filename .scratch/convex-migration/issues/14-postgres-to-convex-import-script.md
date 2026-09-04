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

**Status:** resolved

- [x] A full dry-run against the development deployment imports every Voucher and every
      recognised Site Setting. (Ran against dev Convex deployment `dev:elegant-badger-234`
      reading the dev Postgres database `devdb`: 97/97 vouchers and 13/13 recognised Site
      Settings inserted. Two legacy rows under typo'd keys — `enalbe.voucher.buy`,
      `enalbe.voucher.pool.buy` — are not in the settings vocabulary and correctly failed
      visibly per the box below instead of being silently imported or defaulted.)
- [x] Running it a second time produces no duplicates and no changed data. (Second run: 0
      inserted / 97 unchanged for vouchers, 0 inserted / 13 unchanged for settings, same two
      reported failures.)
- [x] Legacy `used` vouchers arrive as redeemed; the legacy value appears nowhere in the
      validator. (No `"used"` value appears in the dev dataset, but `normalizeVoucherStatus`
      maps it and is unit-tested; `convex/schema.ts`'s status union has no `"used"` member.)
- [x] Prices arrive as exact integer cents. (`reaisToCents` rounds instead of truncating;
      unit-tested against a value that doesn't round-trip through `* 100` exactly. Verified
      against real data: R$70 -> 7000, the R$0,01 test row -> 1.)
- [x] `visitDate` and `expiresAt` are both populated from the old single column, and the rule
      used to split them is stated in the script. (See the "Splitting rule" comment on
      `splitExpiresAt` in `scripts/import-postgres-to-convex/transform.ts`.)
- [x] Referrer rows arrive embedded on their voucher; vouchers without one are valid. (44/44
      Referrer rows folded onto their voucher's `referrer` field; the other 53 vouchers import
      with `referrer` absent.)
- [x] Site Settings arrive under the existing key vocabulary with the value selected from the
      legacy EAV column matching its declared type; price settings arrive as integer cents and
      `updatedBy`/`updatedAt` are preserved. (Declared type is read from `DEFAULT_SETTINGS`,
      not the legacy `type` column. `voucher.price`/`voucher.pool.price` converted 70 -> 7000;
      `disabled.days` arrived as `["2025-10-02","2025-09-30"]` from `jsonValue`.)
- [x] An unknown setting key or a value that does not match its declared type fails visibly
      rather than silently falling back to a default. (Demonstrated live: the two typo'd keys
      threw `SettingImportError` and were reported in the final summary with a non-zero exit;
      also unit-tested for both the unknown-key and type-mismatch cases.)
- [x] Voucher, Referrer and Site Setting row counts plus a summary of what was written are
      reported at the end. (See the "=== Postgres -> Convex import report ===" block the script
      prints.)
- [x] Nothing writes to Postgres. (The script only ever calls `PrismaClient.<model>.findMany()`,
      routed through a `toReadonlyReader` wrapper that hands transform code a plain object
      exposing just those three read methods — never the Prisma client itself — so no
      create/update/delete call is reachable from the file, not merely undocumented.)

## Comments

Dry run executed live against the Convex development deployment
(`dev:elegant-badger-234`, confirmed via `npx convex dev --once`'s "(dev)" banner) and the
Postgres database in `.env.local`'s `DATABASE_URL` (database name `devdb`, confirmed distinct
from any production database; 97 vouchers / 44 referrers / 15 site settings). Both runs are
recorded above. Production Postgres and the Convex production deployment were never touched —
the script has no code path that accepts `--prod`, and additionally refuses to run unless
`CONVEX_DEPLOYMENT` starts with `dev:`.

Design notes:

- `convex/import.ts` adds two internal mutations, `importVouchers`/`importSettings`, upserting
  by natural key (skip if the code/key already exists) — the idempotency mechanism.
- The script invokes them via `node node_modules/convex/bin/main.js run <fn> <json>` (the
  Convex CLI's own entry point) rather than `npx convex run`, because on Windows neither
  spawning `npx.cmd` without a shell nor spawning it through cmd.exe with array args survives a
  JSON payload containing spaces/quotes intact.
- `isTest` is always written `false` for imported rows: the flag didn't exist in the legacy
  schema, so nothing legacy can be honestly marked a Test Voucher (a few very old rows are named
  "tester"/priced at R$0,01, but inferring `isTest` from that would be a guess this migration
  doesn't make).
- Moved `endOfSaoPauloDayMs`/`startOfSaoPauloDayMs` out of `convex/vouchers.ts` into the shared
  `src/lib/utils/date.ts` (next to `getSaoPauloDateKey`, which already lived there) so the
  standalone script and the live app compute Sao Paulo day boundaries from one place, not two.
