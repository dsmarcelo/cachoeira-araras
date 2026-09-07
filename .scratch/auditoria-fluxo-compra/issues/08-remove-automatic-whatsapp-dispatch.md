# 08: Remove automatic WhatsApp dispatch

**What to build:** Confirm payments without sending automated messages via Twilio or WhatsApp, directing the customer to "Meus Vouchers" and the already available download. Manual contacts independent of payment must continue working.

Now that PR 2 provides "Meus Vouchers" and direct OG image downloads, the automated WhatsApp message after payment confirmation can be cleanly removed without being replaced by another channel in this step:
- Remove `src/server/voucher-whatsapp.ts` and its import and call in `src/app/api/webhook/route.ts`.
- Preserve payment confirmation, idempotency, and conversion events, including ensuring repeated webhook notifications do not duplicate conversion.
- Review the return value of `confirmPayment` and its consumers, removing only fields and contracts used exclusively for messaging.
- Update comments referencing WhatsApp in `convex/vouchers.ts`, affected tests, and mocks.
- Remove the `twilio` dependency and update the lockfile after verifying no other consumers exist.
- Remove Twilio variables from environment validation, examples, and README (including instructions that assigned message dispatch to admin). Remove config from deployments once the code stops consuming them.
- Review `formatWhatsAppMessage` in `src/lib/utils.ts` and remove if left without consumers.
- Update customer instructions that previously promised automated WhatsApp delivery to point to "Meus Vouchers" and image download.
- Preserve manual contact links with the waterfall or customer that do not rely on automated messaging.

**Blocked by:** None (can start immediately; the completed PR 2 already provides the customer-facing replacement).

**Status:** ready-for-agent

- [ ] Payment confirmation updates the Voucher and records conversion without calling Twilio.
- [ ] Replaying the same webhook notification remains idempotent and does not duplicate conversion.
- [ ] `src/server/voucher-whatsapp.ts` and its import/call in `src/app/api/webhook/route.ts` are removed.
- [ ] Contracts used exclusively by WhatsApp messaging, the `twilio` dependency, and its configuration are removed from code, lockfile, env schemas, and documentation.
- [ ] Customer instructions point to "Meus Vouchers" and download, without promising an automated message.
- [ ] Manual contact links remain available where independent of automated sending.
- [ ] Existing affected tests pass; no frivolous tests checking for absence of files or strings are added.

Implementation notes:
- PR reference: PR 9 (`chore(payment): remove a integração Twilio e WhatsApp de pagamentos`) — Size: S/M, Impact: Medium · Depends on PR 2.
- References: `src/server/voucher-whatsapp.ts`, `src/app/api/webhook/route.ts`, `convex/vouchers.ts`, `src/lib/utils.ts` (`formatWhatsAppMessage`), `package.json` (`twilio`).
