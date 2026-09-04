# 02: Suppress conversion events for one-centavo payments (throwaway)

**What to build:** Facebook and Google stop being told that a R$0,01 staff test purchase is a
conversion. Today every approved payment reports one, so ad optimisation is being trained on
one-centavo sales.

This is deliberately disposable. Ticket 12 introduces the server-set Test Voucher flag, which
is the real fix; this guard is deleted there. It is optional: worth shipping if cutover is
weeks away, skippable if it is days.

Ships to `main`. Code only.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] An approved payment at the nominal test price fires no Facebook Pixel and no Google Ads
      conversion event.
- [x] An approved payment at any real price still fires both, unchanged.
- [x] WhatsApp delivery is unaffected either way.
- [x] No change to `schema.prisma`, to the database, or to any stored row.
- [x] The guard is written so it is obvious at cutover that it is to be removed.
