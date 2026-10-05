import type { Doc } from "../_generated/dataModel";

/**
 * Outcome of the chargeback case behind a `charged_back` payment, read from
 * the case's `coverage_applied` (`null` open, `true` won, `false` lost).
 * `undefined` means no case was found or looked up.
 */
export type ChargebackOutcome = "open" | "won" | "lost";

/** The Official Payment's current state as reported by Mercado Pago. */
export type ProviderPaymentState = {
  status: string | null;
  statusDetail?: string;
  /** Integer cents returned to the customer; read only for partial refunds. */
  refundedCents?: number;
  chargebackOutcome?: ChargebackOutcome;
};

export type VoucherReversalState = Pick<
  Doc<"vouchers">,
  "status" | "expiresAt" | "reversal" | "paymentIssue"
>;

/**
 * Fields to write on the voucher. A key that is present with `undefined`
 * clears the field; an absent key leaves it alone.
 */
export type ReversalPatch = Partial<
  Pick<Doc<"vouchers">, "status" | "reversal" | "paymentIssue">
>;

type PaymentIssue = NonNullable<Doc<"vouchers">["paymentIssue"]>;

/** Statuses of a Voucher whose payment was approved at some point. */
export const paidVoucherStatuses = new Set<Doc<"vouchers">["status"]>([
  "valid",
  "redeemed",
  "expired",
  "refunded",
]);

/** Reversal reason stored for a lost chargeback: the only revertible one. */
const revertibleReason = "charged_back";

/**
 * Whether a reversal can still be undone. Only a reversal caused by a
 * chargeback qualifies; refunds, cancellations and legacy reasons are
 * permanent.
 */
export function isRevertibleReversal(
  reversal: VoucherReversalState["reversal"],
): boolean {
  return reversal?.reason === revertibleReason;
}

/**
 * The effect of the Official Payment's provider state on its Voucher (the
 * table in ADR 0007). Pure: returns the patch to write, or `null` when the
 * Voucher is already in step. Apply it with `patchVoucher`. Excess Payments
 * never go through here; they only update their own `payments` row.
 *
 * - `approved`: unchanged, except `partially_refunded` flags a partial refund
 *   and any other approval clears the flag.
 * - `in_mediation`, or `charged_back` with an open case: flags a dispute.
 * - `charged_back` lost (or with no case information): reversed. The reason
 *   stays `charged_back`, so a later win can undo it.
 * - `charged_back` won: flag cleared; a chargeback-caused reversal is undone
 *   (refunded goes back to valid, or expired when past its expiry).
 * - `refunded`, `cancelled`: reversed permanently.
 * - Any other status (`in_process`, `authorized`, ...): nothing.
 *
 * Reversed: a valid Voucher becomes refunded; a redeemed or expired one keeps
 * its status and records the reversal. An existing reversal is never
 * overwritten, except to make a chargeback-caused one permanent when a refund
 * or cancellation follows. A reversed Voucher carries no flag: its status
 * already says what happened.
 */
export function decideReversalPatch(
  voucher: VoucherReversalState,
  provider: ProviderPaymentState,
  now: number,
): ReversalPatch | null {
  if (!paidVoucherStatuses.has(voucher.status)) return null;

  switch (provider.status) {
    case "approved":
      return provider.statusDetail === "partially_refunded"
        ? flag(voucher, "partial_refund", provider, now)
        : clearFlag(voucher);
    case "in_mediation":
      return flag(voucher, "dispute", provider, now);
    case "charged_back":
      if (provider.chargebackOutcome === "open") {
        return flag(voucher, "dispute", provider, now);
      }
      if (provider.chargebackOutcome === "won") {
        return resolveWonChargeback(voucher, now);
      }
      return reverse(voucher, "charged_back", now);
    case "refunded":
    case "cancelled":
      return reverse(voucher, provider.status, now);
    default:
      return null;
  }
}

function flag(
  voucher: VoucherReversalState,
  kind: PaymentIssue["kind"],
  provider: ProviderPaymentState,
  now: number,
): ReversalPatch | null {
  if (voucher.reversal !== undefined) return null;

  const current = voucher.paymentIssue;
  const next: PaymentIssue = {
    kind,
    status: provider.status ?? "",
    statusDetail: provider.statusDetail,
    refundedCents:
      kind === "partial_refund" ? provider.refundedCents : undefined,
    // The flag keeps the date it was first raised while its kind is unchanged.
    notedAt: current?.kind === kind ? current.notedAt : now,
  };
  const unchanged =
    current?.kind === next.kind &&
    current.status === next.status &&
    current.statusDetail === next.statusDetail &&
    current.refundedCents === next.refundedCents;
  return unchanged ? null : { paymentIssue: next };
}

function clearFlag(voucher: VoucherReversalState): ReversalPatch | null {
  return voucher.paymentIssue === undefined
    ? null
    : { paymentIssue: undefined };
}

function reverse(
  voucher: VoucherReversalState,
  reason: string,
  now: number,
): ReversalPatch | null {
  const patch: ReversalPatch = {};

  if (voucher.reversal === undefined) {
    patch.reversal = { reason, notedAt: now };
    if (voucher.status === "valid") patch.status = "refunded";
  } else if (
    reason !== revertibleReason &&
    isRevertibleReversal(voucher.reversal)
  ) {
    // A refund or cancellation after a chargeback: from now on it cannot revert.
    patch.reversal = { reason, notedAt: voucher.reversal.notedAt };
  }

  if (voucher.paymentIssue !== undefined) patch.paymentIssue = undefined;
  return Object.keys(patch).length === 0 ? null : patch;
}

function resolveWonChargeback(
  voucher: VoucherReversalState,
  now: number,
): ReversalPatch | null {
  const patch: ReversalPatch = {};

  if (isRevertibleReversal(voucher.reversal)) {
    patch.reversal = undefined;
    if (voucher.status === "refunded") {
      patch.status = voucher.expiresAt > now ? "valid" : "expired";
    }
  }

  if (voucher.paymentIssue !== undefined) patch.paymentIssue = undefined;
  return Object.keys(patch).length === 0 ? null : patch;
}
