# 11: Admin summaries and daily sales

**What to build:** An admin picks a date range and sees vouchers sold, visitors expected, and
revenue for that period, plus a day-by-day breakdown so trends are visible.

Revenue arithmetic is exact — integer cents throughout, converted to reais only for display —
so totals do not drift from floating-point accumulation.

Test Vouchers are excluded from every summary and every revenue figure, so the numbers
describe real business rather than being dragged toward zero by one-centavo purchases.

The range is required and defaults to the current month, because these endpoints read every
matching voucher and reduce in memory.

**Blocked by:** 04, 07

**Status:** ready-for-agent

- [ ] A bounded range returns voucher count, visitor count and revenue for that period.
- [ ] With no range chosen, the current month is used.
- [ ] An unbounded or absent range is refused rather than scanning everything.
- [ ] Revenue totals are exact for any combination of prices.
- [ ] Daily figures break the range down by day.
- [ ] A Test Voucher inside the range changes no figure.
- [ ] Soft-deleted vouchers are excluded.
- [ ] A staff-role caller cannot reach any of it.
