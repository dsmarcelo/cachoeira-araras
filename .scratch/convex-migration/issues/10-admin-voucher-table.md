# 10: Admin voucher table

**What to build:** An admin browses every voucher and finds any record: page-number pagination
as today, substring search across code, name and phone so a partial memory of any of them is
enough, and filters by status and creation date range. The table updates live, so nobody
stares at a stale list while payments arrive. Referrer attribution is visible per row.

An admin can correct a voucher's status, soft-delete a voucher so a mistake is reversible, and
view soft-deleted vouchers separately to audit or restore them.

Production holds roughly one thousand vouchers growing at about fifty a month, so the list
loads the full filtered set in one reactive query and paginates and searches in the browser.
No search index and no cursor pagination: both would trade true substring matching and an
accurate page count for scale more than a decade away.

**Blocked by:** 04, 07

**Status:** resolved

- [x] Searching a fragment of a code, a name, or a phone finds the matching vouchers.
- [x] Status and creation-date-range filters narrow the list, and the page count reflects the
      filtered set.
- [x] A payment confirmed elsewhere appears in the open table without a refresh.
- [x] Editing a status persists it; soft-deleting removes the voucher from the main list.
- [x] Soft-deleted vouchers are viewable separately and can be restored to the main list.
- [x] Referrer source is visible for a voucher that has one.
- [x] Clicking a customer's phone number opens that customer's WhatsApp conversation in a
      new tab; no message is sent by the app.
- [x] Test Vouchers do not appear in the admin list.
- [x] A staff-role caller cannot reach any of it.
