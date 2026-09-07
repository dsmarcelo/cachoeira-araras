# 08: Remove automatic WhatsApp dispatch

**What to build:** Confirm payments without sending automated messages via Twilio or WhatsApp, directing the customer to "Meus Vouchers" and the already available download. Manual contacts independent of payment must continue working.

**Blocked by:** None (can start immediately; the completed PR 2 already provides the customer-facing replacement).

**Status:** ready-for-agent

- [ ] A payment confirmation updates the Voucher and records the conversion without calling Twilio.
- [ ] Replaying the same notification remains idempotent and does not duplicate conversion.
- [ ] Contracts used only for messaging, the Twilio dependency, and its configuration are removed from code, examples, and documentation.
- [ ] Customer instructions point to "Meus Vouchers" and download, without promising an automated message.
- [ ] Manual contact links with the waterfall or customer remain available when they do not depend on automated sending.
