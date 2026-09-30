import type {
  CreatePaymentRequest,
  OperationRequest,
  PaymentSnapshot,
  ProviderIntent,
} from "../lib/paymentOperation";
import type * as adapter from "../lib/mercadopagoOperations";
import { MercadoPagoApiError } from "../lib/mercadopagoError";

type Mode =
  | "success"
  | "transientFailure"
  | "lostResponse"
  | "unauthorized"
  // Provider refuses the request outright (HTTP 400): nothing was created.
  | "badRequest";
type Kind = OperationRequest["kind"];

/** Only the provider is fake: state survives a lost response and subsequent retries. */
export function createMercadoPagoFake() {
  const modes = new Map<Kind, Mode[]>();
  const payments = new Map<string, PaymentSnapshot>();
  // Charges created per idempotency key: a retry returns the original charge.
  const createdByKey = new Map<string, PaymentSnapshot>();
  // Outcome of the next created charge; defaults to a pending Pix.
  let nextCreated: Partial<PaymentSnapshot> = {};
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
    if (mode === "badRequest")
      throw new MercadoPagoApiError(400, "bad_request", "Invalid payer email");
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
    createPayment: (input: CreatePaymentRequest, intent: ProviderIntent) =>
      perform("createPayment", intent, () => {
        const previous = createdByKey.get(intent.idempotencyKey);
        if (previous) return previous;
        const id = `pay-${payments.size + 1}`;
        const created: PaymentSnapshot = {
          id,
          status: "pending",
          statusDetail: "pending_waiting_transfer",
          externalReference: input.externalReference,
          amount: input.amountCents / 100,
          refundedAmount: 0,
          currency: "BRL",
          paymentMethodId: input.paymentMethodId,
          paymentTypeId: "bank_transfer",
          expiresAt: input.expiresAt,
          pix: { qrCode: `000201pix-${id}`, qrCodeBase64: "iVBORw0KGgo=" },
          ...nextCreated,
        };
        nextCreated = {};
        payments.set(id, created);
        createdByKey.set(intent.idempotencyKey, created);
        return created;
      }),
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
    | "refundPayment"
    | "createPayment"
  >;
  return {
    api,
    payments,
    refunds,
    invalidatedPreferences,
    attempts,
    createdByKey,
    /** Shape the next created charge, e.g. `{ status: "rejected" }`. */
    createNext: (overrides: Partial<PaymentSnapshot>) => {
      nextCreated = overrides;
    },
    approveOnCancel: (paymentId: string) => approveWhenCancelled.add(paymentId),
    respondWith: (kind: Kind, ...responses: Mode[]) => {
      modes.set(kind, responses);
    },
  };
}
