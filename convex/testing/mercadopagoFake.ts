import type { OperationRequest, ProviderIntent } from "../lib/paymentOperation";
import type * as adapter from "../lib/mercadopagoOperations";
import { MercadoPagoApiError } from "../lib/mercadopagoError";

type Mode = "success" | "transientFailure" | "lostResponse" | "unauthorized";
type Kind = OperationRequest["kind"];

/** Only the provider is fake: state survives a lost response and subsequent retries. */
export function createMercadoPagoFake() {
  const modes = new Map<Kind, Mode[]>();
  const payments = new Map<
    string,
    {
      id: string;
      status: string;
      externalReference: string | null;
      amount: number;
      refundedAmount: number;
      statusDetail?: string;
      refundedCents?: number;
      /** Test-only: drives searchPaymentsUpdatedBetween (epoch ms). */
      dateLastUpdated?: number;
    }
  >();
  const chargebacks = new Map<string, adapter.ChargebackCase[]>();
  const failing = { chargebacks: false, search: false };
  const invalidatedPreferences = new Set<string>();
  const refunds = new Map<
    string,
    { id: string; status: "approved"; amount: number }
  >();
  const attempts: Array<{ kind: Kind; key: string }> = [];
  const approveWhenCancelled = new Set<string>();
  async function perform<T>(
    kind: Kind,
    intent: ProviderIntent,
    effect: () => T,
  ): Promise<T> {
    attempts.push({ kind, key: intent.idempotencyKey });
    const mode = modes.get(kind)?.shift() ?? "success";
    if (mode === "transientFailure")
      throw new Error("Transient provider failure");
    if (mode === "unauthorized")
      throw new MercadoPagoApiError(
        401,
        "invalid_token",
        "Invalid access token",
      );
    const result = effect();
    if (mode === "lostResponse") throw new Error("Provider response lost");
    return structuredClone(result);
  }
  function payment(id: string) {
    const found = payments.get(id);
    if (!found) throw new Error("Payment not found");
    return found;
  }
  const api = {
    invalidatePreference: (id: string, intent: ProviderIntent) =>
      perform("invalidatePreference", intent, () => {
        invalidatedPreferences.add(id);
        return { id, invalidated: true as const };
      }),
    findPaymentsByExternalReference: (
      reference: string,
      intent: ProviderIntent,
    ) =>
      perform("search", intent, () =>
        [...payments.values()].filter((p) => p.externalReference === reference),
      ),
    cancelPayment: (id: string, intent: ProviderIntent) =>
      perform("cancel", intent, () => {
        const p = payment(id);
        if (approveWhenCancelled.delete(id)) p.status = "approved";
        if (["pending", "in_process", "authorized"].includes(p.status))
          p.status = "cancelled";
        return p;
      }),
    findChargebacksByPayment: async (paymentId: string) => {
      if (failing.chargebacks) throw new Error("Chargeback lookup failed");
      return structuredClone(chargebacks.get(paymentId) ?? []);
    },
    searchPaymentsUpdatedBetween: async (beginMs: number, endMs: number) => {
      if (failing.search) throw new Error("Incomplete payment search");
      return structuredClone(
        [...payments.values()].filter(
          (p) =>
            p.dateLastUpdated !== undefined &&
            p.dateLastUpdated >= beginMs &&
            p.dateLastUpdated <= endMs,
        ),
      );
    },
    getPayment: async (id: string, _intent: ProviderIntent) =>
      structuredClone(payment(id)),
    refundPayment: (id: string, intent: ProviderIntent) =>
      perform("refund", intent, () => {
        const previous = refunds.get(intent.idempotencyKey);
        if (previous) return previous;
        const p = payment(id);
        if (p.status !== "approved") throw new Error("Payment not approved");
        const refund = {
          id: `refund-${refunds.size + 1}`,
          status: "approved" as const,
          amount: p.amount,
        };
        p.status = "refunded";
        p.refundedAmount = p.amount;
        refunds.set(intent.idempotencyKey, refund);
        return refund;
      }),
  } satisfies Pick<
    typeof adapter,
    | "invalidatePreference"
    | "findPaymentsByExternalReference"
    | "cancelPayment"
    | "getPayment"
    | "findChargebacksByPayment"
    | "searchPaymentsUpdatedBetween"
    | "refundPayment"
  >;
  return {
    api,
    payments,
    refunds,
    /** Chargeback cases by payment id; absent = no cases. */
    chargebacks,
    /** Make chargeback lookup / updated-since search throw until reset with `on = false`. */
    failNext: (what: keyof typeof failing, on = true) => {
      failing[what] = on;
    },
    invalidatedPreferences,
    attempts,
    approveOnCancel: (paymentId: string) => approveWhenCancelled.add(paymentId),
    respondWith: (kind: Kind, ...responses: Mode[]) => {
      modes.set(kind, responses);
    },
  };
}
