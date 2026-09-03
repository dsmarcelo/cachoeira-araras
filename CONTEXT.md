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
The day the visitor chose to come, fixed at purchase. It is never changed by staff,
because reporting and gate planning depend on it describing the visitor's intent.
_Avoid_: intended date, expiry date

**Expiry**:
The moment a Voucher stops being redeemable. Distinct from the Visit Date: staff may
extend an Expiry to resolve a problem at the gate, and doing so does not change the
day the visitor originally chose.

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

### Purchase

**Voucher Purchase Intake**:
The server-side flow that starts a customer voucher purchase. It owns the initial
purchase rules: validating quantities and Visit Date, deriving the authoritative
price from Site Settings, generating the Voucher Code, creating the Mercado Pago
checkout preference, persisting the Pending Voucher, and recording optional
Referrer attribution. Callers never supply server-owned state such as price or
status.

**Referrer**:
The marketing channel a purchase arrived from, captured once at purchase and
belonging to the Voucher it describes.

### Configuration

**Site Setting**:
A single named piece of business configuration an admin can change without a
deploy: prices, quantity limits, the booking window, closed days, and the toggles
that enable each entry type. Every change records who made it.
