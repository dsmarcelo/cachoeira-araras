import { expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";
import type { OperationRequest } from "./lib/paymentOperation";

let fake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  refundPayment: (...args: Parameters<typeof fake.api.refundPayment>) =>
    fake.api.refundPayment(...args),
  invalidatePreference: (
    ...args: Parameters<typeof fake.api.invalidatePreference>
  ) => fake.api.invalidatePreference(...args),
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof fake.api.findPaymentsByExternalReference>
  ) => fake.api.findPaymentsByExternalReference(...args),
  cancelPayment: (...args: Parameters<typeof fake.api.cancelPayment>) =>
    fake.api.cancelPayment(...args),
}));

const requests: OperationRequest[] = [
  { kind: "refund", paymentId: "123" },
  { kind: "invalidatePreference", preferenceId: "pref-1" },
  { kind: "search", externalReference: "ABC123" },
  { kind: "cancel", paymentId: "456" },
];

for (const request of requests) {
  for (const mode of ["success", "transientFailure", "lostResponse"] as const) {
    test(`${request.kind}: ${mode} reconciles the same recorded intent`, async () => {
      const t = createConvexTest();
      fake = createMercadoPagoFake();
      fake.payments.set("123", {
        id: "123",
        status: "approved",
        externalReference: "ABC123",
        amount: 50,
        refundedAmount: 0,
      });
      fake.payments.set("456", {
        id: "456",
        status: "pending",
        externalReference: "ABC123",
        amount: 50,
        refundedAmount: 0,
      });
      fake.respondWith(request.kind, mode);
      const id = await t.mutation(internal.paymentOperations.record, {
        request,
      });
      expect(
        (await t.query(internal.paymentOperations.get, { id })).result,
      ).toBeUndefined();
      if (mode !== "success") {
        await expect(
          t.action(internal.paymentOperations.execute, { id }),
        ).rejects.toThrow();
        const unresolved = await t.query(internal.paymentOperations.get, {
          id,
        });
        expect(unresolved.result).toBeUndefined();
        expect(unresolved.lastError).toBeTruthy();
      }
      const result = await t.action(internal.paymentOperations.execute, { id });
      expect(
        await t.action(internal.paymentOperations.execute, { id }),
      ).toEqual(result);
      const saved = await t.query(internal.paymentOperations.get, { id });
      expect(saved.result).toEqual(result);
      expect(saved.lastError).toBeUndefined();
      expect(new Set(fake.attempts.map((attempt) => attempt.key)).size).toBe(1);
      if (request.kind === "refund") {
        expect(result).toEqual({
          id: "refund-1",
          status: "approved",
          amount: 50,
        });
        expect(fake.refunds.size).toBe(1);
      } else if (request.kind === "search") {
        expect(result).toMatchObject([{ id: "123" }, { id: "456" }]);
      } else if (request.kind === "cancel") {
        expect(result).toMatchObject({ id: "456", status: "cancelled" });
      } else {
        expect(result).toEqual({ id: "pref-1", invalidated: true });
      }
    });
  }
}
