# 11: Admin summaries and daily sales

**What to build:** An admin picks a date range and sees vouchers sold, visitors expected, and
revenue for that period, plus a day-by-day breakdown so trends are visible.

Revenue arithmetic is exact — integer cents throughout, converted to reais only for display —
so totals do not drift from floating-point accumulation.

Test Vouchers are excluded from every summary and every revenue figure, so the numbers
describe real business rather than being dragged toward zero by one-centavo purchases.

The query always runs with a bounded range because these endpoints read every matching voucher
and reduce in memory. When both bounds are omitted, the server uses the current calendar month
in Sao Paulo. Supplying only one bound, or explicitly requesting an unbounded range, is refused.

**Blocked by:** 04, 07

**Status:** ready-for-agent

- [ ] A bounded range returns voucher count, visitor count and revenue for that period.
- [ ] With both bounds omitted, the current calendar month in Sao Paulo is used.
- [ ] A request with only one bound, or an explicitly unbounded range, is refused rather than
      scanning everything.
- [ ] Revenue totals are exact for any combination of prices.
- [ ] Daily figures break the range down by day.
- [ ] A Test Voucher inside the range changes no figure.
- [ ] Soft-deleted vouchers are excluded.
- [ ] A staff-role caller cannot reach any of it.
