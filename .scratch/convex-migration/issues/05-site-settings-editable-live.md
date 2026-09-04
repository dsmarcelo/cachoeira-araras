# 05: Site Settings, editable live

**What to build:** An admin changes prices, quantity limits, the booking window, disabled
days, entry-type toggles and banner messages from the settings page, and the change reaches
visitors immediately — without a deploy and without a refresh. Each change records who made
it and when, so a surprising value can be traced.

Admin inputs accept prices in reais and convert to cents on write; storage is always cents.

**Blocked by:** 03, 04

**Status:** resolved (admin half; EAV column removal and visitor-facing live reads deferred to 07)

- [x] An admin editing a setting sees it saved, with the editor and timestamp recorded.
- [ ] A visitor's open page reflects a settings change without reloading.
- [x] Two admins editing different settings at the same time do not overwrite each other.
- [x] Prices typed in reais are stored in cents and displayed back in reais unchanged.
- [x] A non-admin cannot write any setting.
- [ ] The EAV type enum, the four nullable value columns, and the structural typing that
      existed to keep `any` out of the old accessor are all gone.
