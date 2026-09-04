# 08: Payment confirmation

**What to build:** When Mercado Pago approves a payment, the voucher becomes valid without
anyone refreshing anything, the customer receives a WhatsApp message with their code, date,
entry counts and amount, and conversion events fire — for real purchases only.

Repeated webhook deliveries are ordinary, so confirmation is idempotent: a second delivery for
an already-confirmed voucher changes nothing and reports no new conversion, and an
already-redeemed voucher is never reverted.

The webhook stays a Next.js route through cutover and becomes a thin adapter calling a Convex
action. It is not moved to a Convex HTTP action: live preferences carry their notification URL
baked in and live ten days, so relocating would require both URLs to work at once on a payment
path.

A failed or abandoned payment leaves no permanent trace on the customer's phone number, so
they can try again later.

**Blocked by:** 07

**Status:** resolved

- [x] An approved payment flips the voucher to valid, and an open payment-status page reflects
      it without a reload.
- [x] A repeated delivery for an already-confirmed voucher changes nothing and fires no second
      conversion event.
- [x] A delivery for an already-redeemed voucher does not revert it.
- [x] The WhatsApp message sends once and carries code, Visit Date, entry counts and amount.
- [x] A Test Voucher fires no Facebook Pixel and no Google Ads conversion event, and still
      sends its WhatsApp message.
- [x] An abandoned or failed payment does not block the same phone number from buying later.
- [x] The existing webhook test suite is retained, with its payment-processing dependency
      repointed at the Convex side.
