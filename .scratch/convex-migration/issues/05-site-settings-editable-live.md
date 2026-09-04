# 05: Site Settings, editable live

**What to build:** An admin changes prices, quantity limits, the booking window, disabled
days, entry-type toggles and banner messages from the settings page, and the change reaches
visitors immediately — without a deploy and without a refresh. Each change records who made
it and when, so a surprising value can be traced.

Admin inputs accept prices in reais and convert to cents on write; storage is always cents.

**Blocked by:** 03, 04

**Status:** resolved

- [x] An admin editing a setting sees it saved, with the editor and timestamp recorded.
- [x] A visitor's open page reflects a settings change without reloading. (Closed in 07:
      `PriceTable` and `VoucherForm` now read `api.settings.getAll`, a live Convex query.)
- [x] Two admins editing different settings at the same time do not overwrite each other.
- [x] Prices typed in reais are stored in cents and displayed back in reais unchanged.
- [x] A non-admin cannot write any setting.
- [x] The EAV type enum, the four nullable value columns, and the structural typing that
      existed to keep `any` out of the old accessor are all gone. (Closed in 07: deleted
      `src/lib/settings.ts` and its remaining callers — the tRPC `settings` router and the
      Prisma-backed checkout path.)
