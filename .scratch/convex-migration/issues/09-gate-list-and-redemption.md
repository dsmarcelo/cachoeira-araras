# 09: Gate list and redemption

**What to build:** Gate staff open a list of the vouchers expected today and watch it update
live as payments are confirmed, so a customer who paid two minutes ago appears without a
refresh. They redeem a voucher by typing its code; a redeemed voucher is visibly terminal so
the same party cannot be admitted twice; and a voucher outside today's operational window is
refused so nobody is admitted on the wrong day.

When a customer has a legitimate reason, staff can reactivate a voucher. Reactivating extends
the Expiry and never touches the Visit Date the customer chose — the current schema conflates
the two, which is why reactivation corrupts reporting today.

The day rolls over at midnight in Sao Paulo, not at 21:00 as it does now on UTC servers.

Test Vouchers are hidden from the list, but remain redeemable by code so the full
purchase-to-entry path can be verified.

**Blocked by:** 04, 07

**Status:** resolved

- [x] The list shows today's expected vouchers and updates live on payment confirmation.
- [x] "Today" begins and ends at midnight Sao Paulo time regardless of server timezone.
- [x] Typing a valid code redeems it; the voucher is then visibly terminal and a second
      attempt is refused.
- [x] Redeeming outside today's operational window is refused with a clear reason.
- [x] Reactivating changes `expiresAt` and leaves `visitDate` untouched.
- [x] A Test Voucher is absent from the list and redeemable by typing its code.
- [x] A public caller cannot read the list or redeem anything.

Boxes 1 and 6 were ticked before the gate-page UI (`today-vouchers.tsx`,
`employee-today-vouchers.tsx`, and the redeem/reactivate buttons in the two
voucher info cards) was actually wired onto `listToday` / `listTodayAdmin` /
`redeemByCode` / `reactivate`. They stayed on tRPC/Prisma, which ticket 07
stopped writing to, so the gate list showed nothing real. Fixed by wiring
those components directly onto Convex (`useQuery`/`useMutation`), and by
adding an admin-only `listTodayAdmin` query so the admin gate card's payment
details stay unreachable from an employee session.
