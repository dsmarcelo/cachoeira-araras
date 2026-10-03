# Finance integrity

Vouchers are the source of truth. Daily summaries are derived, recomputable data grouped by São Paulo purchase day. A day with no qualifying revenue has no summary. Product inclusion rules are defined in [Payments and reporting](../product/payments.md).

Voucher updates pass through a shared write boundary that schedules recomputation when their revenue contribution changes. Recalculation covers both old and new purchase days where necessary. Reports are eventually consistent with these scheduled writes; do not repair totals by editing summaries manually.

Bulk imports bypass ordinary update scheduling. After an import, complete the purchase-date/search backfill before rebuilding summaries. See the [import runbook](../operations/postgres-to-convex-cutover.md). The daily safety job recomputes the most recent seven days; it cannot repair older imported history by itself.
