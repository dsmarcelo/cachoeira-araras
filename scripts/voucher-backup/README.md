# Voucher and referrer backup

From the repository root, using Node 24 and `DATABASE_URL` in `.env.local`:

```sh
pnpm vouchers:backup backups/vouchers-2026-09-30.json.gz
pnpm vouchers:restore backups/vouchers-2026-09-30.json.gz
```

Restore targets the database in `DATABASE_URL`. Both `Voucher` and `Referrer`
must already exist and be empty. It refuses populated tables; it does not delete,
merge, or overwrite records. Use a disposable database with the existing Prisma
schema to test recovery first. These commands do not run migrations.

The compressed JSON file contains only these two tables, including every scalar
field, original IDs, timestamps, payment references, and soft-deleted vouchers.
Backup uses two table reads in one consistent, read-only snapshot. Compression
runs locally after the transaction closes, reducing file size without additional
database work. This is a complete backup each time, not an incremental backup.
No dependencies, indexes, database backup tables, or scheduled jobs are added.

Restore validates file format, dates, unique keys, and voucher/referrer links
before connecting. It inserts vouchers before referrers in batches of 500 within
one transaction, then resets their ID sequences so subsequent purchases can
allocate fresh IDs. Concurrent writes are blocked during recovery; run it while
the application is stopped. Failure rolls back inserted rows (Postgres sequence
changes themselves are not transactional). Transactions have a 60-second limit.

The scripts hold the two tables in memory, suitable for the small voucher dataset
described in the migration script. Much larger datasets may require streaming.
No exact Aiven quota usage is guaranteed: backup still reads all rows once.

Use a new filename per backup: existing files are never overwritten. `backups/`
is ignored by Git, and new files have owner-only permissions on systems that
support them. Compression is not encryption; the file contains customer data
and payment URLs. Keep a secure copy outside the repository/computer as well.
Files saved outside `backups/` need their own Git exclusion.

Validation:

```sh
pnpm test:voucher-backup
```

Manual recovery check on a disposable database:

1. Create a backup of a fixture database containing vouchers and referrers.
2. Point `.env.local` at an empty disposable database with the same schema and
   run restore. Compare row counts and all fields with the source, including IDs,
   timestamps, nulls, and soft-deleted records.
3. Run restore again: it must refuse and leave all existing rows unchanged.
4. Create a new voucher and referrer through the application; their IDs should
   exceed the restored IDs.
5. Try a truncated backup file: restore must fail before changing any rows.
