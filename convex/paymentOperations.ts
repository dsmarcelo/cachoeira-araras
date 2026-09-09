import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import schema from "./schema";
import {
  operationRequest,
  operationResult,
  type OperationResult,
} from "./lib/paymentOperation";
import {
  refundPayment,
  invalidatePreference,
  findPaymentsByExternalReference,
  cancelPayment,
} from "./lib/mercadopagoOperations";

// Call from the owning transaction and retain the returned id for every retry.
export const record = internalMutation({
  args: { request: operationRequest },
  returns: v.id("paymentOperations"),
  handler: async (ctx, { request }) => {
    const target =
      "paymentId" in request
        ? request.paymentId
        : "preferenceId" in request
          ? request.preferenceId
          : request.externalReference;
    if (!target.trim() || target.length > 200)
      throw new Error("Invalid provider target");
    return await ctx.db.insert("paymentOperations", { request });
  },
});

export const get = internalQuery({
  args: { id: v.id("paymentOperations") },
  returns: schema.doc("paymentOperations"),
  handler: async (ctx, { id }) => {
    const intent = await ctx.db.get("paymentOperations", id);
    if (!intent) throw new Error("Payment operation not found");
    return intent;
  },
});

export const reconcile = internalMutation({
  args: {
    id: v.id("paymentOperations"),
    result: v.optional(operationResult),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, result, error }) => {
    const intent = await ctx.db.get("paymentOperations", id);
    if (!intent) throw new Error("Payment operation not found");
    // A concurrent failed attempt must never overwrite a successful result.
    if (intent.result !== undefined) return null;
    await ctx.db.patch(
      "paymentOperations",
      id,
      result !== undefined
        ? { result, completedAt: Date.now(), lastError: undefined }
        : { lastError: error },
    );
    return null;
  },
});

// Internal only: later cancellation/refund flows own authorization and scheduling.
export const execute = internalAction({
  args: { id: v.id("paymentOperations") },
  returns: operationResult,
  handler: async (ctx, { id }): Promise<OperationResult> => {
    const intent = await ctx.runQuery(internal.paymentOperations.get, { id });
    if (intent.result !== undefined) return intent.result;
    const providerIntent = {
      idempotencyKey: `mp-${id}`,
      recordedAt: intent._creationTime,
    };
    try {
      const request = intent.request;
      let result: OperationResult;
      switch (request.kind) {
        case "refund":
          result = await refundPayment(request.paymentId, providerIntent);
          break;
        case "cancel":
          result = await cancelPayment(request.paymentId, providerIntent);
          break;
        case "search":
          result = await findPaymentsByExternalReference(
            request.externalReference,
            providerIntent,
          );
          break;
        case "invalidatePreference":
          result = await invalidatePreference(
            request.preferenceId,
            providerIntent,
          );
          break;
      }
      await ctx.runMutation(internal.paymentOperations.reconcile, {
        id,
        result,
      });
      return result;
    } catch (error) {
      await ctx.runMutation(internal.paymentOperations.reconcile, {
        id,
        error: (error instanceof Error
          ? error.message
          : "Provider request failed"
        ).slice(0, 500),
      });
      throw error;
    }
  },
});

export const executeWithRetry = internalAction({
  args: {
    id: v.id("paymentOperations"),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, attempt = 1 }) => {
    try {
      await ctx.runAction(internal.paymentOperations.execute, { id });
      return null;
    } catch {
      const maxAttempts = 5;
      if (attempt < maxAttempts) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 60000);
        await ctx.scheduler.runAfter(
          delayMs,
          internal.paymentOperations.executeWithRetry,
          { id, attempt: attempt + 1 },
        );
      }
      return null;
    }
  },
});

