import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Once a day at midnight in Brasilia/Sao Paulo: expire past-due vouchers,
// soft-delete stale Pending Vouchers, and hard-delete Test Vouchers older than
// thirty days.
//
// Convex cron expressions are UTC, and Sao Paulo has used a fixed UTC-3 offset
// since Brazil abolished daylight saving in 2019, so 03:00 UTC is local
// midnight. That instant is exactly 1ms after `expiresAt` for a voucher whose
// visit date was the day just ended (see `endOfSaoPauloDayMs` in
// convex/vouchers.ts), so a voucher for 07/09 expires in the run that opens
// 08/09 and is gone for the whole of that day.
//
// The job body lives in convex/maintenance.ts, kept as an internalMutation so
// it stays reachable from convex-test.
crons.cron(
  "daily voucher maintenance",
  "0 3 * * *",
  internal.maintenance.runDailyMaintenance,
  {},
);

export default crons;
