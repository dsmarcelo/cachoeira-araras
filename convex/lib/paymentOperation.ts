import { v, type Infer } from "convex/values";

export const operationRequest = v.union(
  v.object({
    kind: v.literal("invalidatePreference"),
    preferenceId: v.string(),
  }),
  v.object({ kind: v.literal("search"), externalReference: v.string() }),
  v.object({ kind: v.literal("cancel"), paymentId: v.string() }),
  v.object({ kind: v.literal("refund"), paymentId: v.string() }),
  // Creates a charge on the embedded checkout. The whole body is persisted so
  // every retry resends exactly the same request under the same idempotency
  // key. `payer` is personal data: keep it in this internal table only.
  v.object({
    kind: v.literal("createPayment"),
    externalReference: v.string(),
    amountCents: v.number(),
    description: v.string(),
    paymentMethodId: v.string(),
    payer: v.object({
      email: v.string(),
      identification: v.optional(
        v.object({ type: v.string(), number: v.string() }),
      ),
    }),
    // date_of_expiration (epoch ms) of a Pix charge.
    expiresAt: v.optional(v.number()),
    // Card charge: the Brick's single-use token (never the card number or CVV).
    card: v.optional(
      v.object({
        token: v.string(),
        installments: v.number(),
        issuerId: v.optional(v.string()),
      }),
    ),
  }),
);

export const paymentSnapshot = v.object({
  id: v.string(),
  status: v.string(),
  externalReference: v.union(v.string(), v.null()),
  amount: v.number(),
  refundedAmount: v.number(),
  paymentTypeId: v.optional(v.string()),
  paymentMethodId: v.optional(v.string()),
  currency: v.optional(v.string()),
  statusDetail: v.optional(v.string()),
  // Pix charge deadline (epoch ms) and copy-and-paste data, when present.
  expiresAt: v.optional(v.number()),
  pix: v.optional(v.object({ qrCode: v.string(), qrCodeBase64: v.string() })),
  // 3DS challenge the buyer must complete to finish a card charge.
  challenge: v.optional(
    v.object({ externalResourceUrl: v.string(), creq: v.string() }),
  ),
});

export const operationResult = v.union(
  v.object({ id: v.string(), invalidated: v.literal(true) }),
  v.array(paymentSnapshot),
  paymentSnapshot,
  v.object({
    id: v.string(),
    status: v.literal("approved"),
    amount: v.number(),
  }),
);
export type OperationResult = Infer<typeof operationResult>;
export type OperationRequest = Infer<typeof operationRequest>;
export type PaymentSnapshot = Infer<typeof paymentSnapshot>;
export type ProviderIntent = { idempotencyKey: string; recordedAt: number };
export type CreatePaymentRequest = Extract<
  OperationRequest,
  { kind: "createPayment" }
>;
