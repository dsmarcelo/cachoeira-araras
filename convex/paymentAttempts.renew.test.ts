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

const MINUTE = 60_000;
// Sao Paulo is a fixed UTC-3.
const at = (date: string, time: string) =>
  new Date(`${date}T${time}-03:00`).getTime();
const TODAY = "2026-09-30";
const TOMORROW = "2026-10-01";

const managementToken = crypto.randomUUID();
const payer = { email: "visitante@example.com" };

beforeEach(() => {
  mpFake = createMercadoPagoFake();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(TODAY, "10:00:00"));
});
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof createConvexTest>;

async function seedVoucher(t: T, overrides: Record<string, unknown> = {}) {
  const visitDate = (overrides.visitDate as string | undefined) ?? TOMORROW;
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
      visitDate,
      expiresAt: at(visitDate, "23:59:59"),
      isTest: false,
      ...overrides,
    }),
  );
}

const submitPix = (t: T) =>
  t.action(api.paymentAttempts.submitPixPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "pix",
    payer,
  });

const submitCard = (t: T) =>
  t.action(api.paymentAttempts.submitCardPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "visa",
    token: "card-token",
    installments: 1,
    payer,
  });

const release = (t: T) =>
  t.action(api.paymentAttempts.releaseCharge, {
    code: "BRICK1",
    managementToken,
  });

const attemptsOf = (t: T) =>
  t.run((ctx) => ctx.db.query("paymentAttempts").collect());

const voucherOf = (t: T) =>
  t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "BRICK1"))
      .unique(),
  );

const providerKinds = () => mpFake.attempts.map((a) => a.kind);

test("an expired Pix is closed at the provider before a new code is generated", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);

  vi.setSystemTime(Date.now() + 31 * MINUTE);
  expect(await release(t)).toEqual({ kind: "released" });
  expect(mpFake.payments.get("pay-1")?.status).toBe("cancelled");

  const renewed = await submitPix(t);
  expect(renewed.status).toBe("pending");
  const [first, second] = await attemptsOf(t);
  expect(first?.status).toBe("cancelled");
  expect(second?.status).toBe("pending");
  expect(second?.expiresAt).toBe(Date.now() + 30 * MINUTE + 10_000);
  const voucher = await voucherOf(t);
  expect(voucher?.status).toBe("pending");
  expect(voucher?.priceCents).toBe(14000);
});

test("a stale page clock is not enough: a charge that cannot be closed blocks the replacement", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);
  vi.setSystemTime(Date.now() + 31 * MINUTE);

  mpFake.respondWith("cancel", "transientFailure");
  const blocked = await submitPix(t);

  expect(blocked.status).toBe("uncertain");
  expect(blocked.message).toMatch(/encerramento/);
  expect(providerKinds().filter((k) => k === "createPayment")).toHaveLength(1);
  expect((await attemptsOf(t))[0]?.status).toBe("pending");
});

test("switching from Pix to card closes the Pix first and leaves the Voucher untouched", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);
  const before = await voucherOf(t);

  mpFake.createNext({ status: "pending", statusDetail: "pending_challenge" });
  const card = await submitCard(t);

  expect(card.status).toBe("pending");
  expect(providerKinds()).toEqual(["createPayment", "cancel", "createPayment"]);
  expect((await attemptsOf(t)).map((a) => a.status)).toEqual([
    "cancelled",
    "pending",
  ]);
  const after = await voucherOf(t);
  expect(after?.status).toBe("pending");
  expect(after?.visitDate).toBe(before?.visitDate);
  expect(after?.expiresAt).toBe(before?.expiresAt);
});

test("switching from card to Pix closes the pending card first", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({ status: "pending", statusDetail: "pending_challenge" });
  await submitCard(t);

  const pix = await submitPix(t);

  expect(pix.status).toBe("pending");
  expect(providerKinds()).toEqual(["createPayment", "cancel", "createPayment"]);
  expect((await attemptsOf(t)).map((a) => a.method)).toEqual(["card", "pix"]);
});

test("two tabs switching at once still end with a single open charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);

  const results = await Promise.allSettled([submitPix(t), submitPix(t)]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const open = [...mpFake.payments.values()].filter(
    (p) => p.status === "pending",
  );
  expect(open).toHaveLength(1);
});

test("a lost response while closing keeps the purchase blocked until the close is confirmed", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);

  mpFake.respondWith("cancel", "lostResponse");
  const blocked = await submitPix(t);
  expect(blocked.status).toBe("uncertain");

  expect(await release(t)).toEqual({ kind: "released" });
  const cancelKeys = mpFake.attempts
    .filter((a) => a.kind === "cancel")
    .map((a) => a.key);
  expect(new Set(cancelKeys).size).toBe(1);
  expect((await submitPix(t)).status).toBe("pending");
});

test("an approval found while closing shows the paid Voucher and starts no other charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);
  mpFake.approveOnCancel("pay-1");

  const result = await submitCard(t);

  expect(result.status).toBe("approved");
  expect(providerKinds().filter((k) => k === "createPayment")).toHaveLength(1);
  expect((await voucherOf(t))?.status).toBe("valid");
  expect((await attemptsOf(t))[0]?.status).toBe("approved");
});

test("a request that never reached the provider stops blocking once it is settled", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "transientFailure");
  expect((await submitPix(t)).status).toBe("uncertain");

  // Same operation, same key; the charge it makes is closed before the next.
  const renewed = await submitPix(t);

  expect(renewed.status).toBe("pending");
  const keys = mpFake.attempts
    .filter((a) => a.kind === "createPayment")
    .map((a) => a.key);
  expect(keys).toHaveLength(3);
  expect(keys[0]).toBe(keys[1]);
  expect((await attemptsOf(t)).map((a) => a.status)).toEqual([
    "cancelled",
    "pending",
  ]);
});

test("an unresolved request keeps blocking while the provider keeps failing", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "transientFailure", "transientFailure");
  await submitPix(t);

  const blocked = await submitPix(t);

  expect(blocked.status).toBe("uncertain");
  expect((await attemptsOf(t)).map((a) => a.status)).toEqual(["uncertain"]);
});

test("a same-day renewal still respects the Pix and card cutoffs", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  await submitPix(t);

  vi.setSystemTime(at(TODAY, "16:35:00"));
  expect(await release(t)).toEqual({ kind: "released" });
  await expect(submitPix(t)).rejects.toThrow(/16h30/);
  expect((await submitCard(t)).status).toBe("approved");
});

test("a late webhook of a replaced charge never adds a second Official Payment", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitPix(t);
  mpFake.createNext({ status: "pending", statusDetail: "pending_challenge" });
  await submitCard(t);

  const confirm = (paymentId: string) =>
    t.mutation(internal.vouchers.confirmPayment, {
      code: "BRICK1",
      paymentId,
      paymentStatus: "approved",
      paymentAmountCents: 14000,
      paymentCurrency: "BRL",
    });
  await confirm("pay-2");
  await confirm("pay-1");
  await confirm("pay-1");

  const payments = await t.run((ctx) => ctx.db.query("payments").collect());
  expect(payments).toHaveLength(2);
  expect(payments.filter((p) => p.isOfficial)).toHaveLength(1);
  expect(payments.find((p) => p.paymentId === "pay-1")?.owesRefund).toBe(true);
});
