import { StatusBadge } from "../_components/admin-ui"
import type { AdminVoucher } from "../voucher-info-card"

/**
 * Payment warnings next to a voucher's status: an open dispute, a partial
 * refund, or a reversal noted after the voucher was already redeemed (a
 * Refunded voucher is already flagged by its status badge).
 */
export function PaymentBadges({ voucher }: { voucher: AdminVoucher }) {
  const { paymentIssue, reversal, status } = voucher
  const reversedAfterUse = reversal !== undefined && status !== "refunded"
  if (!paymentIssue && !reversedAfterUse) return null

  return (
    <>
      {paymentIssue?.kind === "dispute" ? <StatusBadge tone="danger">Pagamento contestado</StatusBadge> : null}
      {paymentIssue?.kind === "partial_refund" ? <StatusBadge tone="warning">Reembolso parcial</StatusBadge> : null}
      {reversedAfterUse ? <StatusBadge tone="danger">Estornado após uso</StatusBadge> : null}
    </>
  )
}
