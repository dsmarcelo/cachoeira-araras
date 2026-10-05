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

// Safety net for the persisted finance summaries: re-summarize the last week
// in case a voucher write missed its scheduled recompute.
crons.cron(
  "recompute recent finance days",
  "15 3 * * *",
  internal.finance.recomputeRecentDays,
  {},
);

// Safety net for Payment Reversals: re-sync every payment Mercado Pago updated
// in the last two days, so a refund or chargeback on a voucher nobody opens
// still reaches it. 04:00 UTC (01:00 in Sao Paulo) leaves the 03:00
// maintenance and 03:15 finance recompute jobs alone, and any day summary the
// sweep changes is recomputed by the voucher writes themselves.
crons.cron(
  "sweep recent payments",
  "0 4 * * *",
  internal.paymentSweep.sweepRecentPayments,
  {},
);

crons.interval(
  "sweep overdue payment refunds",
  { minutes: 15 },
  internal.refunds.sweepOverdueRefunds,
  {},
);

export default crons;
