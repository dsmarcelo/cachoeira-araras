# 13: Daily maintenance cron

**What to build:** Once a day, without anyone doing anything: vouchers past their Expiry become
expired, Pending Vouchers whose Expiry has passed are soft-deleted, and Test Vouchers older than
thirty days are hard-deleted so they do not accumulate forever.

The current job's timezone conversion parses a Sao Paulo wall-clock string as server-local
time, producing a timestamp three hours off; the replacement uses the shared helper.

**Blocked by:** 07

**Status:** resolved

- [x] A voucher past its Expiry and not redeemed becomes expired; one still within its Expiry
      is untouched.
- [x] A redeemed voucher is never transitioned by the job.
- [x] A Pending Voucher whose `expiresAt` is at or before the job's current time is
      soft-deleted; one whose Expiry is still in the future is untouched.
- [x] A Test Voucher older than thirty days is hard-deleted; one at twenty-nine days is not.
- [x] Real vouchers are never hard-deleted.
- [x] Day boundaries are computed in Sao Paulo time.
- [x] The Vercel cron entry is removed.

## Comments

Implemented as `convex/maintenance.ts` (`internalMutation runDailyMaintenance`, invoked by
`convex/crons.ts` on the same daily cadence as the old Vercel cron). All seven boxes verified by
`convex/maintenance.test.ts` under `vi.setSystemTime`, plus `pnpm type-check` and `pnpm lint`.

Day-boundary note: `expiresAt` is already an absolute instant computed against the Sao Paulo
calendar wherever it's written (`endOfSaoPauloDayMs` in `convex/vouchers.ts`, both at purchase
and on `reactivate`). The job therefore only needs the true current instant (`Date.now()`) to
compare against it — it does no timezone conversion of its own, which is what avoids
reproducing the old bug (a Sao Paulo wall-clock string reparsed as server-local time, producing
a "now" three hours off) rather than papering over it.

Deleted `src/app/api/cron/route.ts` and `vercel.json` (its only content was the cron entry), and
removed the now-dead `CRON_SECRET` from `src/env.js` and `.env.example`. Per the migration spec,
the Vercel cron entry is meant to be removed "at cutover" — this branch hasn't merged to `main`,
so production (still on Prisma/Postgres) is unaffected until this branch ships; removing it now
just means the daily maintenance job won't run against Postgres from this branch's checkout,
which matches the ticket instruction directly.
