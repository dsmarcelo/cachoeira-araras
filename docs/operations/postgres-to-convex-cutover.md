# PostgreSQL import and cutover

Prisma remains necessary for the legacy importer and payment E2E script. Repository code cannot establish whether production cutover has completed; verify the deployed data and migration evidence before removing that tooling.

The importer reads Vouchers and Referrers without writing PostgreSQL. It does not import Site Settings. It converts prices to cents and normalizes dates and states, reporting rejected rows instead of silently supplying defaults. Mutation-based import skips existing Voucher Codes without updating them; a rerun should insert zero rows.

## Rehearsal

1. Back up the source and use read-only PostgreSQL credentials. Select an isolated Convex development target and configure `DATABASE_URL` and `CONVEX_DEPLOYMENT=dev:...` in `.env.local`.
2. Run `pnpm test:import`, then `pnpm import:postgres-to-convex`. This importer deliberately refuses non-development deployments.
3. Resolve every reported failure and compare counts, codes, amounts, states, dates and attribution. Imports can partially succeed before reporting conversion failures.
4. Rerun and verify existing codes are reported unchanged.
5. Complete the backfill and financial rebuild below before checking search and reporting.

## Bulk alternative

`pnpm export:postgres-to-convex` creates `.import-data/vouchers.jsonl`; conversion failure prevents export. Import it with `pnpm exec convex import --table vouchers --append .import-data/vouchers.jsonl` only after checking the target and existing data. This bypasses the mutation importer's development guard and code deduplication. Append can duplicate codes; replace deletes existing table contents. Neither mode is a safe merge of an unknown dataset.

Protect the export as customer data and remove it after verified import.

## Backfill and financial rebuild

On the same selected target, run these in order:

```bash
pnpm exec convex run migrations:backfillVoucherPurchasedAtAndSearchText
# Wait for scheduled backfill batches to complete before continuing.
pnpm exec convex run finance:rebuildAll
```

Wait for scheduled rebuild batches to complete, then verify search and financial totals. Add `--prod` to each command only when deliberately targeting production. Command return does not mean scheduled work has finished.

## Production cutover

1. Confirm the production target, take restorable backups and pause legacy writes during the migration window.
2. Rehearse on a current source snapshot and reconcile existing destination codes before importing. The mutation importer needs a reviewed target-guard change to support production; the bulk alternative requires explicit destination and duplicate handling.
3. Import with read-only source credentials, preserve the outcome report, then backfill and rebuild on the same target.
4. Compare source/destination counts and representative records. Configure business settings separately and validate purchase, approval, reporting and gate entry before directing traffic to Convex.
5. Keep PostgreSQL read-only through the rollback window. If reverting traffic after Convex receives new writes, reconcile those writes first; switching URLs alone can lose purchases or redemption history.

Retire Prisma only after cutover verification, the rollback window and replacement of its remaining E2E consumer.
