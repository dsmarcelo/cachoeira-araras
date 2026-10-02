# Cachoeira das Araras

A natural attraction that sells dated entry vouchers online. Visitors buy a voucher
for a chosen day, pay through Mercado Pago, and present a short code at the gate.

## Language

### Voucher

**Voucher**:
A prepaid right of entry for a named party on a chosen day. It is created when a
purchase begins, becomes usable once payment is approved, and is consumed at the gate.

**Voucher Code**:
The short string that identifies a Voucher everywhere it is spoken, typed, or sent
to an external system. It is the Voucher's identity; no other identifier is used
across contexts.
_Avoid_: voucher id, voucher number

**Visit Date**:
The day the Voucher is currently booked for, chosen at purchase and moved only by a
Reschedule. Gate redemption and the gate's daily list are keyed on it.
_Avoid_: intended date, expiry date

**Expiry**:
The moment a Voucher stops being redeemable: the end of its Visit Date in Sao Paulo.
A Reschedule recomputes it with the Visit Date. Staff may also extend it alone to
resolve a problem at the gate, which does not change the Visit Date.

**Reschedule**:
Moving a Voucher to another Visit Date, which always moves the Expiry with it. Price,
quantities and payments never change. Only the last Reschedule is kept: when it
happened and who made it (the customer or a named admin). A customer may reschedule a
Pending or Valid Voucher that has not expired, to any day a purchase would allow, as
often as they like. An admin may also reschedule an Expired Voucher (it becomes Valid
again) to any day from today on, ignoring the booking window and closed days.
Employees cannot reschedule.

**Test Voucher**:
A Voucher created by staff to exercise the real purchase and payment path at a
nominal price. It is excluded from every operational list and every revenue figure,
and generates no advertising conversion, but is redeemable like any other Voucher.

### Voucher Status

**Pending**:
Purchase has begun and payment has not been approved.

**Valid**:
Payment is approved and the Voucher may be redeemed.

**Redeemed**:
The party has entered. Terminal.
_Avoid_: used

**Expired**:
The Voucher passed its Expiry without being redeemed. Terminal.

**Cancelled**:
The purchase was abandoned before payment. The Voucher remains in the historical
record and terminal; any payment approved later is automatically refunded.

### Purchase

**Voucher Purchase Intake**:
The server-side flow that starts a customer voucher purchase. It owns the initial
purchase rules: validating quantities and Visit Date, deriving the authoritative
price from the server environment, generating the Voucher Code, creating the Mercado Pago
checkout preference, persisting the Pending Voucher, and recording optional
Referrer attribution. Callers never supply server-owned state such as price or
status.

**Referrer**:
The marketing channel a purchase arrived from, captured once at purchase and
belonging to the Voucher it describes.

### Payment

**Official Payment**:
The first approved payment attached to a Voucher. It is the only payment that may
make that Voucher Valid.

**Excess Payment**:
An approved payment received after the Official Payment or after the Voucher was
Cancelled. It never changes the Voucher and is refunded in full automatically.

**Payment Refund**:
The tracked return of an Excess Payment to the customer. It remains in progress
until the payment provider confirms the full refund.

### Configuration

**Site Setting**:
A single named piece of business configuration an admin can change without a
deploy: prices, quantity limits, the booking window, closed days, and the toggles
that enable each entry type. Every change records who made it.
