# Track payment reversals by reconciling paid vouchers with Mercado Pago

Status: accepted

Money can return to a customer long after a Voucher became Valid: a refund made
in the Mercado Pago panel, a cancellation, a mediation, or a card chargeback
that can take up to six months to resolve. The Voucher only learned about these
through the payment webhook, and nothing re-checked a paid Voucher afterwards,
so a missed or undelivered notification left it Valid forever (a real Voucher
with an open chargeback was still redeemable). The webhook also dropped
`status_detail`, so an opened chargeback looked identical to a resolved one and
a partial refund (`approved` / `partially_refunded`) was invisible.

Mercado Pago is the source of truth for every payment that has an Official
Payment. The Voucher derives its entitlement from the provider's current state
of that payment, refreshed by three triggers that share one update path:

- **On view**: Meus Vouchers, the admin voucher table's visible rows and Validar
  voucher ask Mercado Pago for the Official Payment's state, at most once per
  minute per Voucher. Validar holds redemption until its check finishes; if
  Mercado Pago cannot answer, staff see that it could not be confirmed and may
  redeem with the last known state, so a provider outage never stops the gate.
- **Daily sweep**: one paged search for payments updated in the last two days
  catches changes on Vouchers nobody opens (Redeemed and Expired ones that
  still count as revenue).
- **Webhook**: unchanged, now carrying `status_detail`.

The provider state maps to the Voucher as follows:

| Provider state of the Official Payment | Voucher |
| --- | --- |
| `approved` | unchanged; a reversal caused by a chargeback is undone, since the money stayed with the seller |
| `approved` / `partially_refunded` | unchanged; flagged as a partial refund with the refunded amount |
| `in_mediation`, or `charged_back` with the case undecided | unchanged; flagged as a payment in dispute |
| `charged_back`, case lost | reversed |
| `charged_back`, case won | flag cleared; a reversal caused by that case is undone |
| `refunded`, `cancelled` | reversed, permanently |

"Reversed" keeps today's meaning: a Valid Voucher becomes Refunded; a Redeemed
or Expired Voucher keeps its state and records a reversal, which removes its
revenue. A chargeback outcome is read from the chargeback case
(`coverage_applied`: `true` won, `false` lost, `null` undecided), never from the
payment's `settled`/`reimbursed` detail, which Mercado Pago documents
inconsistently.

A Voucher reversed by a lost chargeback is the one exception to "Refunded never
reverts": if the case is later won (or the payment returns to `approved`), it returns to Valid (or Expired when past
its Expiry) and its revenue counts again. Refunds and cancellations never
revert.

The dispute and partial-refund flags are visible to admins and to employees at
the gate; customers see only the resulting state.

## Considered Options

- Fix the status mapping only: missed notifications still go undetected, since
  the mapping already existed and the event never arrived.
- Subscribe to the `chargebacks` webhook topic: faster dispute signal but needs
  panel configuration and a second notification shape; on-view checks and the
  sweep already cover it.
- Block entry as soon as a dispute opens: protects revenue but turns away
  customers whose dispute the business may still win.
- Block redemption when Mercado Pago is unreachable: money-safe, but an
  outage would stop the gate.
- Periodically re-fetch every paid Voucher: one call per Voucher; a search
  by last update needs a handful of calls per day.

## Consequences

- Reading a paid Voucher can trigger a provider call; throttling bounds the
  cost, and failures never block views or redemption.
- Validar redemption gains up to one provider round trip of latency.
- The Voucher stores the Official Payment's provider status detail and
  dispute/partial-refund flags; reports and the gate read only Voucher state.
- Refunded is no longer strictly terminal: a won chargeback can revert it.
- An open dispute still counts as revenue until it is lost.
