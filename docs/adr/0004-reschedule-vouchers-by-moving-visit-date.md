# Reschedule vouchers by moving the Visit Date

Status: accepted

Customers and admins need to move a voucher to another day. Until now the
domain said the Visit Date is never changed by staff, and only the Expiry could
move. But both gate redemption and the gate's daily list are keyed on the Visit
Date. So moving only the Expiry can never make a voucher usable on a different
day. Revenue reporting groups by purchase time, not Visit Date, so the original
reason for freezing the Visit Date no longer holds.

Rescheduling is a first-class domain operation that rewrites the Visit Date and
always recomputes the Expiry as the end of the new day in Sao Paulo. The two
fields move together, and nothing else changes: price, quantities, payments,
and the Mercado Pago checkout are untouched. Each Voucher records only its most
recent reschedule: when it happened, and who did it (`customer` or the admin's
username).

The two actors follow different rules:

- **Customer**: allowed on a Pending or Valid voucher whose Expiry hasn't
  passed. Authorized by the voucher's lookup capability, so holding the code is
  enough. The new date must pass the same Visit Date rule as a purchase
  (booking window, closed days, not in the past). No limit on how many times.
- **Admin**: allowed on a Pending, Valid, or Expired voucher. An Expired voucher
  becomes Valid again. Any date from today on is allowed; the booking window
  and closed days don't apply. Employees cannot reschedule.

## Considered Options

- Extend only the Expiry and let redemption accept any day between Visit Date
  and Expiry. This keeps the original Visit Date but loosens the gate rule and
  makes the daily gate list ambiguous.
- Let admins edit the Expiry as a raw field. This does nothing useful, because
  redemption ignores the Expiry's day.
- Keep a full history of reschedules. Rejected for now (YAGNI); the last change
  is enough to explain a surprise at the gate.

## Consequences

- The Visit Date now means "the day the visit is currently booked for", not
  "the day chosen at purchase". The previously booked day is not kept; only
  when the last reschedule happened and who did it.
- Customer rescheduling and purchase share a single Visit Date rule, so a
  change to the booking window or closed days applies to both.
- A future step that also requires the customer's phone number would only
  change the customer authorization, not this model.
