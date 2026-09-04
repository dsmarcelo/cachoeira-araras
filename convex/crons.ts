import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Once a day: expire past-due vouchers, soft-delete stale Pending Vouchers,
// and hard-delete Test Vouchers older than thirty days. Same daily cadence as
// the Vercel cron this replaces; the job body lives in
// convex/maintenance.ts, kept as an internalMutation so it stays reachable
// from convex-test.
crons.cron(
  "daily voucher maintenance",
  "0 0 * * *",
  internal.maintenance.runDailyMaintenance,
  {},
);

export default crons;
