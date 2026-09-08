import { v, type Infer } from "convex/values";

export const operationRequest = v.union(
  v.object({
    kind: v.literal("invalidatePreference"),
    preferenceId: v.string(),
  }),
  v.object({ kind: v.literal("search"), externalReference: v.string() }),
  v.object({ kind: v.literal("cancel"), paymentId: v.string() }),
  v.object({ kind: v.literal("refund"), paymentId: v.string() }),
);

export const paymentSnapshot = v.object({
  id: v.string(),
  status: v.string(),
  externalReference: v.union(v.string(), v.null()),
  amount: v.number(),
  refundedAmount: v.number(),
});

export const operationResult = v.union(
  v.object({ id: v.string(), invalidated: v.literal(true) }),
  v.array(paymentSnapshot),
  paymentSnapshot,
  v.object({ id: v.string(), status: v.string(), amount: v.number() }),
);
export type OperationResult = Infer<typeof operationResult>;
export type OperationRequest = Infer<typeof operationRequest>;
export type PaymentSnapshot = Infer<typeof paymentSnapshot>;
export type ProviderIntent = { idempotencyKey: string; recordedAt: number };
