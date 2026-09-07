# 01: Mark purchase as service in Mercado Pago

**What to build:** Make checkout identify the Voucher purchase as a service, so that Mercado Pago does not present physical product delivery guarantees and shipping messages to the customer.

Without `category_id`, Mercado Pago treats the purchase as a physical product and displays "Devolvemos seu dinheiro se você não receber o pacote" in the checkout flow (confirmed in sandbox). Setting `category_id: "services"` ensures Mercado Pago treats vouchers as a service.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Every preference created for a normal or test purchase classifies its item as a service (`category_id: "services"`).
- [x] The remaining preference data, including price, description, and return URLs, remains unchanged.
- [x] A focused test verifies the category sent to Mercado Pago.

Implementation notes:
- PR reference: PR 3 (`fix(mercadopago): marca items da preferência como serviço`) — Size: XS, Impact: Medium.
- Target: add `category_id: "services"` to the preference item in `convex/lib/mercadopago.ts:126`.
