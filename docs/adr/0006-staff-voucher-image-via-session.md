# Staff render voucher images through their session

Status: accepted. Supersedes [0005](0005-admin-voucher-image-via-lookup-capability.md).

Admins and employees need to show, download and send a customer's voucher
image from every staff voucher drawer (the voucher table, the gate list and
Validar voucher), identical to the one in Meus Vouchers. ADR 0005 handed admins
the voucher's lookup capability, but that capability also authorizes the
customer reschedule, and employees must not be able to reschedule (ADR 0004).

The image route accepts two authorizations: the customer's lookup capability,
unchanged, or a signed-in staff session. For a staff request it reads the image
data as that user through a staff-only operation, so a staff member never
holds a voucher's capability. Images are offered for every paid voucher (not
Pending, Cancelled or deleted), the same set the route renders for customers.

Sending to WhatsApp uses the device share sheet with the image file; where
sharing files is unsupported, the image is downloaded and the customer's chat
is opened for the staff member to attach it. The app never sends anything
itself.

## Considered Options

- Hand staff the lookup capability (ADR 0005, widened to employees): one
  authorization rule on the route, but gives employees a path to reschedule.
- An image-only signed ticket: keeps one rule on the route, at the cost of new
  signing and expiry machinery.

## Consequences

- The image route has two authorization paths; both read the same fields and
  apply the same status rule.
- Staff images require a live session; a downloaded PNG is the only thing that
  leaves the app.
- The image shows the price, which employees can therefore see.
