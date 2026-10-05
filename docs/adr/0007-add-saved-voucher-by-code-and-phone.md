# Add a saved Voucher by Voucher Code and phone

Status: accepted

"Meus Vouchers" lists only purchases started in the current browser. A customer
on another device, or after clearing browser data, has no way to bring a
Voucher back into that list. The list lives in browser storage by design;
there are no customer accounts.

The customer adds a Voucher by typing its Voucher Code and the phone number
used at purchase. The server finds the Voucher by code and compares phone
digits, ignoring formatting so legacy imported phones still match. Both must
be correct: if only one matches, nothing about the Voucher is returned or
saved. A match returns the same lookup capability `authorizeLookup` returns, and the browser
saves the Voucher into its local list. A mismatch, an unknown code and a
soft-deleted Voucher all produce one generic answer, so the form cannot
confirm whether a code exists. Every attempt spends from the shared anonymous
lookup rate limit, so this form is no cheaper to sweep than the existing
lookup. On top of that, wrong tries are capped at 5 per phone and 5 per
Voucher Code in each 30-minute window, so one phone cannot sweep codes and
one code cannot be phone-guessed; successful searches do not count.

The form accepts Voucher Codes of 4 to 6 characters from `a-z0-9`,
lowercased. This covers legacy 4-character codes, today's 6-character codes,
and the planned 5-character codes.

Adding a Voucher this way grants what the lookup capability grants: viewing,
downloading the image and customer rescheduling. It never returns the
management capability, so resuming or cancelling a Pending payment stays with
the browser that started the purchase. Vouchers in any status can be added.

"Meus Vouchers" is always reachable from the header and shows an empty state
instead of redirecting, so a customer with no saved Vouchers can reach the form.

## Considered Options

- Also return the management capability: lets a new device resume or cancel a
  payment, but a phone number is weak proof, and cancellation is destructive.
- Distinct errors for unknown code vs wrong phone: friendlier, but confirms
  that a guessed code exists.
- Client-only save without server verification: impossible to show status
  without a lookup, and it would store unverified codes.

## Consequences

- The phone is a confirmation step, not a security boundary: code-only
  `authorizeLookup` still exists and grants the same capability. Making the
  phone mandatory for public lookups would be a separate decision.
- Vouchers added this way have no management capability or saved checkout
  link; their cards cannot resume or cancel a payment, and refund notices tied
  to the management capability are not shown.
- Browser retention still counts from the Voucher's creation, so an old
  Voucher re-added near the end of its two-year window disappears soon after.
