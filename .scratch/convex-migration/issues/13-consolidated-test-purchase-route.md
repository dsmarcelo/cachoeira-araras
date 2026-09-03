# 13: Consolidated test purchase route

**What to build:** Staff buy a voucher for R$0,01 through the real Mercado Pago integration
from one predictable URL under the admin tree, verifying production credentials, webhook
signature and notification URL together — without anyone needing to remember an obscured path.

Test mode is authorised on the server from the session role, so a visitor cannot buy at R$0,01
by manipulating the client. The resulting voucher is marked as a Test Voucher by the server,
from that same authorisation check — never from a name someone types, and never from client
input, so the marking cannot be forgotten or edited away.

The two existing obscured staff-gated routes are removed.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The test purchase form lives at one predictable admin URL, and the two obscured routes
      are gone.
- [ ] A non-staff caller attempting a test-priced purchase is refused, including when the
      client asserts test mode itself.
- [ ] The resulting voucher carries the server-set Test Voucher flag; no client input can set
      or clear it.
- [ ] The full path runs: purchase, real payment, webhook, WhatsApp delivery.
- [ ] No conversion event reaches Facebook or Google.
- [ ] The throwaway guard from ticket 02 is deleted, if it was shipped.
