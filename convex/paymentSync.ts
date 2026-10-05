import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { PaymentSnapshot } from "./lib/paymentOperation";
import {
  chargebackOutcome,
  findChargebacksByPayment,
} from "./lib/mercadopagoOperations";
import { confirmPaymentResult } from "./lib/paymentReversal";

/** A payment as last observed at Mercado Pago, tied to the voucher it paid for. */
export const observedPayment = v.object({
  code: v.string(),
  paymentId: v.string(),
  paymentStatus: v.union(v.string(), v.null()),
  paymentAmountCents: v.optional(v.number()),
  paymentTypeId: v.optional(v.string()),
  paymentMethodId: v.optional(v.string()),
  statusDetail: v.optional(v.string()),
  /** Integer cents returned to the customer. */
  refundedCents: v.optional(v.number()),
});
export type ObservedPayment = Infer<typeof observedPayment>;

export type SyncPaymentResult = Infer<typeof confirmPaymentResult>;

/**
 * The one path every observed Mercado Pago payment takes into a voucher
 * (webhook, on-view reconciliation, daily sweep). For `charged_back` it reads
 * the chargeback case first: no case counts as an open dispute (the voucher
 * stays usable), never as a loss. If the case lookup fails this throws and
 * the voucher is left untouched, so callers must treat a rejection as "not
 * synced" and retry or surface it.
 */
export async function syncObservedPayment(
  ctx: ActionCtx,
  observed: ObservedPayment,
): Promise<SyncPaymentResult> {
  const outcome =
    observed.paymentStatus === "charged_back"
      ? (chargebackOutcome(
          await findChargebacksByPayment(observed.paymentId),
        ) ?? "open")
      : undefined;

  return await ctx.runMutation(internal.vouchers.confirmPayment, {
    ...observed,
    ...(outcome ? { chargebackOutcome: outcome } : {}),
  });
}

/**
 * Builds an observation from a provider snapshot, or `null` when the payment
 * carries no external reference (not one of our vouchers).
 */
export function observedFromSnapshot(
  payment: PaymentSnapshot,
): ObservedPayment | null {
  if (!payment.externalReference) return null;
  return {
    code: payment.externalReference,
    paymentId: payment.id,
    paymentStatus: payment.status,
    paymentAmountCents: Math.round(payment.amount * 100),
    paymentTypeId: payment.paymentTypeId,
    paymentMethodId: payment.paymentMethodId,
    statusDetail: payment.statusDetail,
    refundedCents: payment.refundedCents,
  };
}

/** Action wrapper of `syncObservedPayment`, used by the HTTP webhook endpoint. */
export const syncPayment = internalAction({
  args: observedPayment,
  returns: confirmPaymentResult,
  handler: async (ctx, args): Promise<SyncPaymentResult> =>
    syncObservedPayment(ctx, args),
});
