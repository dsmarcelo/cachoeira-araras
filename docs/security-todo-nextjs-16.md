# Security TODOs After Next.js 16 Upgrade

This document summarizes the Red Team findings from the upgraded Next.js 16 working tree.

Note: The `.env` secret-rotation finding is intentionally omitted per project direction.

## Priority 1: Payment-to-voucher binding

**Severity:** High  
**Files:**

- `src/app/(client)/pagamento/page.tsx`
- `src/app/(client)/pagamento/aprovado/page.tsx`
- `src/app/(client)/voucher/page.tsx`
- `src/lib/voucher/server-utils.ts`
- `src/server/voucher.ts`

### Problem

Payment return pages fetch `preference_id` and `payment_id`, then confirm or display voucher data based mainly on payment status. They should also verify that the payment actually belongs to the voucher/preference being confirmed.

### TODO

- Before confirming or displaying a voucher, verify:
  - `payment.status === "approved"`
  - `payment.external_reference === voucher.code`
  - paid amount matches the expected voucher price
  - currency matches the expected currency
  - payment/preference merchant data matches the expected Mercado Pago account where available
- Refactor `confirmVoucherPayment` so it validates trusted payment data, not only query-string IDs.
- Treat `/voucher?code=...&pid=...` as sensitive and verify payment-to-code binding before rendering voucher details.
- Add tests for:
  - valid payment/voucher binding
  - mismatched `external_reference`
  - mismatched amount
  - denied/pending payment
  - unknown preference/payment

## Priority 2: Webhook body-size limit

**Severity:** High  
**File:**

- `src/app/api/webhook/route.ts`

### Problem

The webhook route calls `await request.text()` before enforcing any explicit body-size limit. Unsigned large requests can consume memory/CPU before being rejected.

### TODO

- Reject requests with `Content-Length` above a small limit, for example `64KB`.
- Reject unsupported content types early.
- Consider reading the request body with an enforced cap instead of unbounded `request.text()`.
- Consider route-level rate limiting.
- Add tests for:
  - oversized webhook body rejected
  - valid small JSON webhook still accepted
  - valid small form-encoded webhook still accepted

## Priority 3: Webhook replay protection

**Severity:** Medium  
**Files:**

- `src/server/mercadopago-webhook.ts`
- `src/app/api/webhook/route.ts`
- `src/server/mercadopago-webhook.test.ts`

### Problem

Mercado Pago signature validation parses `ts`, but timestamp freshness is not enforced. A previously valid signed webhook could be replayed, causing repeated Mercado Pago API lookups and processing attempts.

### TODO

- Enforce a timestamp tolerance window, for example 5–10 minutes.
- Reject malformed, missing, or stale `ts` values.
- If Mercado Pago guarantees `x-request-id`, require it for signed payment webhooks.
- Optionally store recent request IDs or signature hashes with a TTL to reject duplicate replays.
- Add tests for:
  - fresh signature accepted
  - stale signature rejected
  - malformed `ts` rejected
  - duplicate request ID/signature rejected, if replay cache is implemented

## Priority 4: Dependency vulnerability remediation

**Severity:** Medium  
**Files:**

- `package.json`
- `pnpm-lock.yaml`

### Problem

`pnpm audit --prod` reported critical/high/moderate/low transitive vulnerabilities. Some notable paths are through runtime dependencies such as `twilio` and payment/auth packages.

### TODO

- Upgrade `twilio` to a version that resolves vulnerable transitive dependencies such as:
  - `axios`
  - `form-data`
  - `follow-redirects`
  - `qs`
- Review advisories affecting:
  - `next-auth`
  - `mercadopago`
  - `uuid`
- Use `pnpm.overrides` only after testing if upstream packages do not yet resolve the vulnerable versions.
- Add this to CI:

  ```bash
  pnpm audit --prod
  ```

- Re-run payment and WhatsApp notification flows after dependency changes.

## Priority 5: Remove broad CORS from webhook routes

**Severity:** Medium  
**File:**

- `next.config.js`

### Problem

Webhook routes currently receive broad CORS headers. Server-to-server webhook endpoints do not need browser CORS, and permissive CORS increases exposure unnecessarily.

### TODO

- Remove CORS headers from:
  - `/api/webhook`
  - `/api/webhooks`
- Keep CORS only on routes that intentionally support browser access, such as `/api/og` if still needed.
- Do not combine:

  ```txt
  Access-Control-Allow-Credentials: true
  Access-Control-Allow-Origin: *
  ```

- Add checks for:
  - webhook requests still work server-to-server
  - browser preflight does not expose webhook routes unnecessarily

## Priority 6: Improve Sentry sanitization

**Severity:** Medium  
**Files:**

- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation-client.ts`
- `src/lib/sentry/payment.ts`

### Problem

Sentry sanitization is incomplete and inconsistent between server and edge config. Payment identifiers and voucher codes may also be too sensitive to attach directly as searchable tags.

### TODO

- Create shared Sentry sanitization helpers.
- Apply equivalent sanitization to server and edge configs.
- Strip sensitive headers case-insensitively:
  - `authorization`
  - `cookie`
  - `x-signature`
  - `x-request-id`
  - payment tokens/secrets
- Avoid placing voucher codes, payment IDs, and preference IDs directly into searchable tags.
- Prefer hashing identifiers or storing redacted values.
- Confirm `sendDefaultPii: false` remains set where appropriate.

## Priority 7: Fix NextAuth role fallback

**Severity:** Low/Medium  
**File:**

- `src/server/auth.ts`

### Problem

The session callback currently defaults any non-employee role to admin:

```ts
role: token.role === "employee" ? "employee" : "admin"
```

If a valid legacy/malformed token lacks a role, it becomes admin.

### TODO

- Only accept explicit roles:
  - `"admin"`
  - `"employee"`
- Default missing or invalid roles to denied access instead of admin.
- Consider invalidating old sessions after changing role semantics.
- Add tests/manual checks for:
  - admin session remains admin
  - employee session remains employee
  - malformed/missing role is denied

## Priority 8: Strengthen environment validation

**Severity:** Low  
**File:**

- `src/env.js`

### Problem

Production env validation exists, but secret quality checks are minimal and `SKIP_ENV_VALIDATION` can bypass validation.

### TODO

- Add minimum lengths for critical secrets, for example:
  - `NEXTAUTH_SECRET.min(32)`
  - `WEBHOOK_SECRET.min(32)`
  - `CRON_SECRET.min(32)`
- Validate password hash format with a regex.
- Prevent `SKIP_ENV_VALIDATION=true` in production/CI release builds.
- Add a deployment checklist that verifies production-critical variables are present.

## Priority 9: Follow up on ESLint security posture

**Severity:** Low  
**File:**

- `eslint.config.mjs`

### Problem

Some React Compiler readiness rules were disabled to avoid changing unrelated UI behavior during the Next.js 16 upgrade. This was intentional, but the disabled rules should be revisited.

### TODO

- Open a separate UI hardening task to review disabled rules:
  - `react-hooks/set-state-in-effect`
  - `react-hooks/refs`
  - `react-hooks/static-components`
  - `react-hooks/purity`
- Refactor affected carousel/date-picker/sidebar patterns safely.
- Re-enable rules once warnings are resolved.

## Checks That Passed

The Red Team review did not find upgrade-specific issues in:

- async `cookies()` migration
- async `headers()` migration
- async page `searchParams` migration
- tRPC async React Server Component context pattern
- basic Next.js 16 build compatibility

Validation already performed during the upgrade:

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm test:webhook
```

`pnpm test:payments` should be rerun when external database connectivity is stable.
