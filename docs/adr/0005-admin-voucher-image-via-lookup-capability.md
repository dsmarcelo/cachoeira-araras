# Admins render voucher images through the lookup capability

Status: superseded by [0006](0006-staff-voucher-image-via-session.md)

Admins need to show, download and send a customer's voucher image from the
`/admin/tabela` drawer, identical to the one in Meus Vouchers. The image route
renders buyer data only for a caller holding the voucher's lookup capability,
which admins never had.

An admin-only operation hands the admin the voucher's existing lookup
capability (issuing one if the voucher has none yet), and the drawer uses the
same public image route as Meus Vouchers. It never spends the shared anonymous
lookup budget, since the caller is an authenticated admin. Images are offered
for every paid voucher (not Pending, Cancelled or deleted), the same set the
image route can render.

Sending to WhatsApp uses the device share sheet with the image file; where
sharing files is unsupported, the image is downloaded and the customer's chat
is opened for the admin to attach it. The app never sends anything itself.

## Considered Options

- Let the image route accept an admin session instead of the capability: a
  second authorization path on a public route and session verification in the
  web server, for no gain over reusing the capability.
- Render a separate admin image: duplicates the design and drifts from what the
  customer sees.

## Consequences

- The image route keeps a single authorization rule: service secret plus lookup
  capability.
- Admins can obtain any voucher's lookup capability. Everything it grants
  (viewing, customer reschedule) is already within admin powers.
- Employees cannot obtain it this way.
