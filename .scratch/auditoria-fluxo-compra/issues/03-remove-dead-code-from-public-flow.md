# 03: Remove dead code from public flow

**What to build:** Reduce the public purchase flow to the behavior the customer actually uses, removing unreachable UI and legacy fields that are always sent as zero, without removing features still used by admin.

`src/app/(client)/comprar/page.tsx:7` performs `redirect("/")` but keeps ~15 lines of unreachable JSX following the redirect, including a duplicate map iframe.

In `src/app/_components/voucher-form.tsx:120`, legacy fields `elderly`, `adults_pool`, and `elderly_pool` still exist in `voucherFormSchema`, in `defaultValues`, and are sent hardcoded as `0` to `startCheckout`. The public form only exposes the standard voucher (`quantity`). Public validation and submission should be cleaned up.

Additionally, `src/app/_components/voucher-buy-test.tsx` and the `voucher.pool.price` Site Setting have no public surface; verify whether they still serve admin consumers before touching them.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The legacy purchase route (`src/app/(client)/comprar/page.tsx`) preserves only the necessary redirect and removes unreachable JSX (e.g., duplicate map iframe).
- [ ] Public validation schema (`voucherFormSchema`) and form submission do not include unused quantities (`elderly`, `adults_pool`, `elderly_pool`) that the customer cannot select.
- [ ] Public Voucher purchase continues sending only data accepted by Voucher Purchase Intake.
- [ ] Test purchase (`voucher-buy-test.tsx`) and the pool Site Setting (`voucher.pool.price`) are retained if they still have administrative consumers; provably orphaned items are removed.

Implementation notes:
- PR reference: PR 5 (`chore(web): remove código morto do fluxo público`) — Size: XS, Impact: Low.
- References: `src/app/(client)/comprar/page.tsx:7`, `src/app/_components/voucher-form.tsx:120`, `src/app/_components/voucher-buy-test.tsx`, `voucher.pool.price` setting.
