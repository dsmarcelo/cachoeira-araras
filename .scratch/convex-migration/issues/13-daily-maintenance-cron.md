# 13: Daily maintenance cron

**What to build:** Once a day, without anyone doing anything: vouchers past their Expiry become
expired, stale pending vouchers are soft-deleted, and Test Vouchers older than thirty days are
hard-deleted so they do not accumulate forever.

The current job's timezone conversion parses a Sao Paulo wall-clock string as server-local
time, producing a timestamp three hours off; the replacement uses the shared helper.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] A voucher past its Expiry and not redeemed becomes expired; one still within its Expiry
      is untouched.
- [ ] A redeemed voucher is never transitioned by the job.
- [ ] Stale pending vouchers are soft-deleted; recent pending ones are not.
- [ ] A Test Voucher older than thirty days is hard-deleted; one at twenty-nine days is not.
- [ ] Real vouchers are never hard-deleted.
- [ ] Day boundaries are computed in Sao Paulo time.
- [ ] The Vercel cron entry is removed.
