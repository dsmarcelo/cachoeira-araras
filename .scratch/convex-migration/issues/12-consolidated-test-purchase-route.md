# 12: Consolidated test purchase route

**What to build:** Staff buy a voucher for R$0,01 through the real Mercado Pago integration
from one predictable URL under the admin tree, verifying production credentials, webhook
signature and notification URL together — without anyone needing to remember an obscured path.

Test mode is authorised on the server from the session role, so a visitor cannot buy at R$0,01
by manipulating the client. The resulting voucher is marked as a Test Voucher by the server,
from that same authorisation check — never from a name someone types, and never from client
input, so the marking cannot be forgotten or edited away.

The two existing obscured staff-gated routes are removed.

**Blocked by:** 08

**Status:** resolved (one checkbox needs manual verification by Marcelo — see below)

- [x] The test purchase form lives at one predictable admin URL, and the two obscured routes
      are gone. Now at `/admin/compra-teste` (`src/app/admin/compra-teste/page.tsx`), staff-gated
      the same way `/admin` is (`requireStaff`), linked from the admin sidebar for both roles.
      `src/app/(client)/tests_iE72e7789D3/` and `src/app/(client)/test__/` are deleted.
- [x] A non-staff caller attempting a test-priced purchase is refused, including when the
      client asserts test mode itself. Already enforced server-side in `startCheckout`
      (`convex/vouchers.ts`) via `validateVoucherPurchase`'s `canUseTestMode` check, derived from
      `getRole(ctx)` off the verified Convex identity — never a client argument. Covered by
      `convex/vouchers.checkout.test.ts`.
- [x] The resulting voucher carries the server-set Test Voucher flag; no client input can set
      or clear it. `isTest` is only ever set after `validateVoucherPurchase` has already thrown
      for an unauthorised caller, so it can never reach `true` on a persisted voucher without
      that server-side role check passing. Added an assertion of the stored `isTest` flag to
      `convex/vouchers.checkout.test.ts` (this didn't exist before — the prior test only checked
      price).
- [ ] The full path runs: purchase, real payment, webhook, WhatsApp delivery. Requires an actual
      R$0,01 purchase against live Mercado Pago; not performed by the agent. Needs manual
      verification by Marcelo.
- [x] No conversion event reaches Facebook or Google. Already shipped in ticket 08: the webhook
      route (`src/app/api/webhook/route.ts`) only sets `shouldSendConversionEvents` when
      `becameValid && !result.isTest`, and WhatsApp delivery is unconditional on `becameValid`.
      Verified by reading the code and running the existing suites
      (`convex/vouchers.confirmPayment.test.ts`, `src/server/mercadopago-webhook.test.ts`); no
      new test added since coverage already exists.
- [x] The throwaway guard from ticket 02 is deleted, if it was shipped. It was shipped
      (commit `a82ab69`) but was already removed when ticket 08 rewrote the webhook route
      (commit `3d3b4de` deleted `NOMINAL_TEST_PURCHASE_AMOUNT`/`isNominalTestPurchase` in favour
      of the real `isTest`-based check). Nothing left to delete at HEAD; confirmed via
      `git log`/`git show` rather than by inspection alone.
