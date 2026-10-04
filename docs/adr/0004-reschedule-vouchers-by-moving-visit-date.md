# Reschedule vouchers by moving the Visit Date

Status: accepted

Customers and admins need to move a voucher to another day. The domain used to
freeze the Visit Date and let staff move only the Expiry, but gate redemption
and the gate's daily list are keyed on the Visit Date, so moving the Expiry
alone never makes a voucher usable on another day. Revenue reporting groups by
purchase time, so freezing the Visit Date protected nothing.

Rescheduling is a domain operation that rewrites the Visit Date and always
recomputes the Expiry as the end of the new Sao Paulo day. Price, quantities,
payments and the Mercado Pago checkout are untouched. Each Voucher records only
its most recent reschedule: when, and by whom (`customer` or an admin username).

- **Customer**: a Pending or Valid voucher whose Expiry hasn't passed,
  authorized by the lookup capability (holding the code is enough). The new day
  must pass the purchase Visit Date rule. Unlimited.
- **Admin**: a Pending, Valid or Expired voucher; Expired becomes Valid. Any day
  from today on, ignoring the booking window and closed days. Employees cannot
  reschedule.

## Considered Options

- Extend only the Expiry and let redemption accept any day up to it: keeps the
  original day but loosens the gate rule and blurs the daily gate list.
- Let admins edit the Expiry directly: useless, since redemption ignores it.
- Keep a full reschedule history: unneeded (YAGNI); the last change suffices.

## Consequences

- The Visit Date means "the day currently booked"; the previous day is lost.
- Purchase and customer rescheduling share one Visit Date rule.
- Adding phone verification later changes only customer authorization.
