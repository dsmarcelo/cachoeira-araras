# 09 — Architecture Deepening Backlog

This document records the five deepening opportunities found during the architecture review.

Use this as an implementation backlog for future agents. Each item is intentionally framed as a problem to explore and implement in a small, focused change.

## 1. Voucher Purchase Intake Module

### Files

- `src/app/_components/voucher-form.tsx`
- `src/server/api/routers/mercadopago.ts`
- `src/server/api/routers/voucher.ts`
- `src/lib/utils/utils.ts`
- `src/server/voucher-purchase.ts`
- `src/server/voucher-purchase-intake-core.ts`
- `src/server/voucher-purchase-intake.ts`

### Problem

The public purchase flow used to be spread across UI, Mercado Pago preference creation, voucher persistence, price calculation, code generation, cookie handling, and referrer attribution.

This made the Module shallow: callers had to know too much ordering and business state.

### Current Status

Partially implemented.

`voucher.startCheckout` now centralizes the main public voucher checkout flow. The UI no longer sends server-owned voucher state such as `code`, `price`, `status`, or `valid`.

### Remaining Work

- Audit and migrate any remaining callers of `mercadopago.create` + `voucher.create`.
- Decide whether old public procedures should remain for compatibility or be removed.
- Add operational monitoring for Mercado Pago preferences created without persisted vouchers.
- Consider whether `src/lib/utils/utils.ts` still needs old env-based price helpers.

### Suggested Validation

```bash
pnpm type-check
pnpm exec eslint src/server/voucher-purchase-intake-core.ts src/server/voucher-purchase-intake.ts src/server/api/routers/voucher.ts src/app/_components/voucher-form.tsx
node --import ts-node/register --test src/server/voucher-purchase-intake.test.ts src/server/voucher-purchase.test.ts src/server/mercadopago-webhook.test.ts
```

Manual QA:

- Create a voucher from the public form.
- Confirm Mercado Pago checkout opens.
- Confirm the voucher is persisted as `pending` and `valid: false`.
- Confirm the persisted price is derived server-side from settings.

## 2. Voucher Lifecycle Module

### Files

- `src/server/voucher.ts`
- `src/server/api/routers/voucher.ts`
- `src/app/api/cron/route.ts`
- `src/lib/voucher/server-utils.ts`
- `src/app/_components/validate-voucher.tsx`
- `src/app/admin/_components/today-vouchers.tsx`
- `src/app/admin/_components/employee-today-vouchers.tsx`

### Problem

Voucher state transitions are scattered across webhook confirmation, public reconciliation, payment return pages, admin redemption, today activation, cron expiry, and direct admin status updates.

The important invariant is repeated in multiple places:

- `pending`: created, payment not confirmed.
- `valid`: payment approved, can be used.
- `redeemed`: already consumed.
- `expired`: expired without use.
- `valid` boolean must stay consistent with `status`.

The current shape leaks implementation details to callers. Many callers directly update `status` and `valid`, which weakens locality.

### Proposed Direction

Create or deepen a Voucher Lifecycle Module that owns allowed transitions:

- confirm payment;
- redeem voucher;
- redeem today's operational voucher;
- activate today's voucher;
- expire valid vouchers;
- soft-delete expired pending vouchers.

Prefer names that describe operations instead of raw field updates.

Avoid exposing a generic `update status` path unless there is a clear admin repair use case.

### Benefits

- State rules are tested through one interface.
- Bugs in `status` / `valid` consistency are fixed in one place.
- Admin, cron, webhook, and public payment flows stop duplicating transition logic.

### Suggested Validation

Add focused tests around lifecycle transitions:

- payment approved moves `pending` to `valid` and `valid: true`;
- duplicate payment confirmation is idempotent;
- redeemed voucher cannot be reconfirmed as newly valid;
- redeem moves `valid` to `redeemed` and `valid: false`;
- cron expiry moves old `valid` vouchers to `expired`;
- cron soft-deletes old `pending` vouchers.

Run:

```bash
pnpm type-check
node --import ts-node/register --test src/server/mercadopago-webhook.test.ts
```

Add a new lifecycle test file if needed.

## 3. Mercado Pago Adapter Consolidation

### Files

- `src/server/mercadopago.ts`
- `src/server/api/routers/mercadopago.ts`
- `src/server/mercadopago-checkout.ts`
- `src/app/api/webhook/route.ts`
- `src/server/voucher-purchase-intake.ts`

### Problem

`src/server/mercadopago.ts` already centralizes some Mercado Pago fetch/search behavior, but `src/server/api/routers/mercadopago.ts` still performs direct `fetch()` calls for preferences and payments.

That means callers still need to know:

- Mercado Pago REST paths;
- token headers;
- failure conventions;
- raw response types;
- which calls are instrumented and which are not.

The seam exists, but is incomplete.

### Proposed Direction

Finish the Mercado Pago Adapter so all Mercado Pago lookup/search behavior flows through `src/server/mercadopago.ts`.

Recommended steps:

- Replace direct fetches in `mercadopagoRouter.getPreference`.
- Replace direct fetches in `mercadopagoRouter.getPublicPreference`.
- Replace direct fetches in `mercadopagoRouter.getPayment`.
- Add a search helper for preferences by `external_reference` if that route is still needed.
- Preserve public contracts, especially `getPublicPreference` returning only `{ init_point }`.

Do not mix this with changing preference creation unless the caller requires it.

### Benefits

- Mercado Pago errors and observability become local.
- Tests can mock one Adapter seam.
- Webhook, admin, and public flows stop diverging in error handling.

### Suggested Validation

```bash
pnpm type-check
pnpm exec eslint src/server/mercadopago.ts src/server/api/routers/mercadopago.ts
node --import ts-node/register --test src/server/mercadopago-webhook.test.ts
```

Manual QA:

- Recover a public preference and confirm `init_point` still works.
- Check any admin view that fetches preference/payment data.
- Confirm webhook payment lookup still works.

## 4. Settings Catalog Module

### Files

- `src/lib/settings.ts`
- `src/app/admin/dashboard/configuracoes/page.tsx`
- `src/app/admin/dashboard/configuracoes/actions.ts`
- `src/app/admin/dashboard/configuracoes/_components/setting-form.tsx`
- `src/app/_components/voucher-form.tsx`
- `src/app/_components/price-table.tsx`

### Problem

Settings are typed and validated in `src/lib/settings.ts`, but admin display metadata and ordering are duplicated in the settings page and actions.

Adding a setting currently requires touching multiple files:

- type key;
- default value;
- validation rule;
- admin label;
- admin description;
- admin input type;
- ordering.

This is a shallow Module because deleting the admin metadata does not remove complexity; it moves the same key knowledge elsewhere.

### Proposed Direction

Create a single Settings Catalog that owns:

- key;
- value type;
- default value;
- validation;
- admin label;
- admin description;
- admin input type;
- admin grouping/order.

`getAllSettings()` should continue returning the typed value map for application code.

Admin pages should derive display forms from the catalog instead of duplicating key lists.

### Benefits

- Adding or changing a setting becomes local.
- Admin UI and runtime validation stay consistent.
- Settings-related tests can use the catalog as the test surface.

### Suggested Validation

Add focused tests for:

- defaults include every catalog key;
- invalid stored values fall back to defaults;
- admin config has no missing keys;
- `disabled.days` validation still accepts only `YYYY-MM-DD`.

Run:

```bash
pnpm type-check
pnpm exec eslint src/lib/settings.ts src/app/admin/dashboard/configuracoes/page.tsx src/app/admin/dashboard/configuracoes/actions.ts src/app/admin/dashboard/configuracoes/_components/setting-form.tsx
```

Manual QA:

- Open `/admin/dashboard/configuracoes`.
- Update one number setting.
- Update one boolean setting.
- Update disabled days.
- Confirm public form reflects settings changes.

## 5. Payment Return Module

### Files

- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/pagamento/aprovado/page.tsx`
- `src/app/(client)/voucher/page.tsx`
- `src/lib/voucher/server-utils.ts`
- `src/server/mercadopago.ts`
- `src/lib/sentry/payment.ts`

### Problem

Payment return handling repeats query validation, Mercado Pago preference/payment fetches, Sentry reporting, missing-payment UI decisions, and voucher confirmation across multiple pages.

The repeated local `fetchPreference` and `fetchPayment` wrappers are shallow. The caller still has to know the full return flow:

- validate query params;
- fetch preference;
- fetch payment;
- branch on `denied`, `pending`, `approved`;
- confirm voucher;
- map failures to UI states;
- record Sentry messages.

### Proposed Direction

Create a Payment Return Module that interprets the Mercado Pago return query and produces a typed outcome for pages to render.

Example outcomes:

- invalid link;
- preference not found;
- payment not found;
- denied payment;
- pending payment with checkout URL;
- approved payment with confirmed voucher;
- approved payment but voucher confirmation failed.

Pages should render outcomes, not perform the payment workflow themselves.

### Benefits

- Customer-facing return states become consistent.
- Sentry instrumentation is local.
- Tests can cover the complete payment-return decision tree without rendering multiple pages.

### Suggested Validation

Add focused tests for the Payment Return Module:

- multi-value query is rejected;
- missing `preference_id` or `payment_id` is rejected;
- missing preference maps to preference error;
- missing payment maps to payment error;
- denied payment maps to denied state;
- pending payment maps to pending checkout state;
- approved payment confirms voucher and returns voucher data.

Run:

```bash
pnpm type-check
pnpm exec eslint 'src/app/(client)/pagamento/page.tsx' 'src/app/(client)/pagamento/aprovado/page.tsx' src/lib/voucher/server-utils.ts
```

Manual QA:

- Return from Mercado Pago approved payment.
- Return from pending payment.
- Open an invalid payment return URL.
- Confirm approved page still shows payment and voucher cards.
