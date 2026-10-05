import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { searchPaymentsUpdatedBetween } from "./lib/mercadopagoOperations";
import { observedFromSnapshot, syncObservedPayment } from "./paymentSync";

/** Look-back window; two days so one missed daily run is still covered. */
const SWEEP_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Daily safety net: runs every payment Mercado Pago updated in the last two
 * days through the shared sync path, so refunds and chargebacks on vouchers
 * nobody opens (redeemed or expired, still counted as revenue) are applied.
 * Payments without an `external_reference` that matches a voucher are skipped.
 *
 * Fails loudly, never as "nothing changed": an incomplete or failed scan
 * throws before any write; a payment that fails to sync (e.g. chargeback
 * lookup rejected) does not stop the others, but the run throws at the end
 * with the failure count so it shows as failed. Syncing is idempotent, so the
 * next run retries whatever failed.
 */
export const sweepRecentPayments = internalAction({
  args: {},
  returns: v.object({
    scanned: v.number(),
    synced: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const payments = await searchPaymentsUpdatedBetween(
      now - SWEEP_WINDOW_MS,
      now,
    );

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    for (const payment of payments) {
      const observed = observedFromSnapshot(payment);
      if (!observed) {
        skipped++;
        continue;
      }
      try {
        const result = await syncObservedPayment(ctx, observed);
        if (result.outcome === "not_found") skipped++;
        else synced++;
      } catch (error) {
        failed++;
        console.error(
          `Payment sweep: failed to sync payment ${payment.id}`,
          error,
        );
      }
    }

    const summary = { scanned: payments.length, synced, skipped };
    console.log("Payment sweep finished", { ...summary, failed });
    if (failed > 0)
      throw new Error(
        `Payment sweep: ${failed} of ${payments.length} payments failed to sync`,
      );
    return summary;
  },
});
