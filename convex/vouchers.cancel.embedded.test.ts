/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let mpFake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  refundPayment: (...args: Parameters<typeof mpFake.api.refundPayment>) =>
    mpFake.api.refundPayment(...args),
  invalidatePreference: (
    ...args: Parameters<typeof mpFake.api.invalidatePreference>
  ) => mpFake.api.invalidatePreference(...args),
  findPaymentsByExternalReference: (
    ...args: Parameters<typeof mpFake.api.findPaymentsByExternalReference>
  ) => mpFake.api.findPaymentsByExternalReference(...args),
  cancelPayment: (...args: Parameters<typeof mpFake.api.cancelPayment>) =>
    mpFake.api.cancelPayment(...args),
  createPayment: (...args: Parameters<typeof mpFake.api.createPayment>) =>
    mpFake.api.createPayment(...args),
}));

const at = (date: string, time: string) =>
  new Date(`${date}T${time}-03:00`).getTime();
const managementToken = crypto.randomUUID();
const payer = { email: "visitante@example.com" };

beforeEach(() => {
  mpFake = createMercadoPagoFake();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at("2026-09-30", "10:00:00"));
});
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof createConvexTest>;

async function seedVoucher(t: T) {
  await t.run((ctx) =>
    ctx.db.insert("vouchers", {
      code: "BRICK1",
      managementToken,
      name: "Visitante Teste",
      phone: "11999991111",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 14000,
      status: "pending",
      visitDate: "2026-10-01",
      expiresAt: at("2026-10-01", "23:59:59"),
      isTest: false,
    }),
  );
}

const pay = (t: T) =>
  t.action(api.paymentAttempts.submitPixPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "pix",
    payer,
  });

const cancel = (t: T) =>
  t.action(api.vouchers.cancelPendingPurchase, {
    code: "BRICK1",
    managementToken,
  });

const voucherOf = (t: T) =>
  t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "BRICK1"))
      .unique(),
  );
const attemptsOf = (t: T) =>
  t.run((ctx) => ctx.db.query("paymentAttempts").collect());

test("cancelling closes the open Pix and reports the purchase as cancelled", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await pay(t);

  const result = await cancel(t);

  expect(result.kind).toBe("cancelled");
  expect((await voucherOf(t))?.status).toBe("cancelled");
  expect(mpFake.payments.get("pay-1")?.status).toBe("cancelled");
  expect((await attemptsOf(t))[0]?.status).toBe("cancelled");
});

test("an approval that wins the race against cancelling presents the paid Voucher", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await pay(t);
  mpFake.approveOnCancel("pay-1");

  const result = await cancel(t);

  expect(result.kind).toBe("already_approved");
  const voucher = await voucherOf(t);
  expect(voucher?.status).toBe("valid");
  expect(voucher?.cancellationStartedAt).toBeUndefined();
});

test("a charge whose creation response was lost is found and closed before cancelling", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "lostResponse");
  expect((await pay(t)).status).toBe("uncertain");

  const result = await cancel(t);

  expect(result.kind).toBe("cancelled");
  expect(mpFake.payments.get("pay-1")?.status).toBe("cancelled");
  expect((await attemptsOf(t))[0]?.status).toBe("cancelled");
});

test("cancelling waits while the result of a charge is unknown, then completes on retry", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "lostResponse", "transientFailure");
  await pay(t);

  const blocked = await cancel(t);

  expect(blocked.kind).toBe("error");
  expect(blocked.message).toMatch(/verificando/);
  const pending = await voucherOf(t);
  expect(pending?.status).toBe("pending");
  expect(pending?.cancellationStartedAt).toBeUndefined();

  expect((await cancel(t)).kind).toBe("cancelled");
  expect(mpFake.payments.get("pay-1")?.status).toBe("cancelled");
});

test("an approval arriving after the purchase was cancelled is refunded in full", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await pay(t);
  await cancel(t);

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
  });

  expect((await voucherOf(t))?.status).toBe("cancelled");
  const [payment] = await t.run((ctx) => ctx.db.query("payments").collect());
  expect(payment).toMatchObject({ owesRefund: true, isOfficial: false });
  const checkout = await t.query(api.paymentAttempts.getCheckout, {
    code: "BRICK1",
    managementToken,
  });
  expect(checkout).toMatchObject({
    kind: "ok",
    lateApproval: true,
  });
});
