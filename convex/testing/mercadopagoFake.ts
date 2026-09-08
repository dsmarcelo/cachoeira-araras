import type { OperationRequest, ProviderIntent } from "../lib/paymentOperation";
import type * as adapter from "../lib/mercadopagoOperations";

type Mode = "success" | "transientFailure" | "lostResponse";
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
    }
  >();
  const invalidatedPreferences = new Set<string>();
  const refunds = new Map<
    string,
    { id: string; status: string; amount: number }
  >();
  const attempts: Array<{ kind: Kind; key: string }> = [];
  async function perform<T>(
    kind: Kind,
    intent: ProviderIntent,
    effect: () => T,
  ): Promise<T> {
    attempts.push({ kind, key: intent.idempotencyKey });
    const mode = modes.get(kind)?.shift() ?? "success";
    if (mode === "transientFailure")
      throw new Error("Transient provider failure");
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
        if (["pending", "in_process", "authorized"].includes(p.status))
          p.status = "cancelled";
        return p;
      }),
    refundPayment: (id: string, intent: ProviderIntent) =>
      perform("refund", intent, () => {
        const previous = refunds.get(intent.idempotencyKey);
        if (previous) return previous;
        const p = payment(id);
        if (p.status !== "approved") throw new Error("Payment not approved");
        const refund = {
          id: `refund-${refunds.size + 1}`,
          status: "approved",
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
    | "refundPayment"
  >;
  return {
    api,
    payments,
    refunds,
    invalidatedPreferences,
    attempts,
    respondWith: (kind: Kind, ...responses: Mode[]) => {
      modes.set(kind, responses);
    },
  };
}
