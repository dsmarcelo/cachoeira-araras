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

async function seedVoucher(
  t: ReturnType<typeof createConvexTest>,
  overrides: Record<string, unknown> = {},
) {
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

function submit(
  t: ReturnType<typeof createConvexTest>,
  overrides: Record<string, unknown> = {},
) {
  return t.action(api.paymentAttempts.submitPixPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "pix",
    payer,
    ...overrides,
  });
}

const attemptsOf = (t: ReturnType<typeof createConvexTest>) =>
  t.run((ctx) => ctx.db.query("paymentAttempts").collect());

const reconcile = (t: ReturnType<typeof createConvexTest>) =>
  t.action(api.voucherReconciliation.reconcileMine, {
    code: "BRICK1",
    managementToken,
  });

const createKeys = () =>
  mpFake.attempts.filter((a) => a.kind === "createPayment").map((a) => a.key);

// The buyer lost the connection after Mercado Pago created the charge.
async function submitWithLostResponse(t: ReturnType<typeof createConvexTest>) {
  mpFake.respondWith("createPayment", "lostResponse");
  const result = await submit(t);
  expect(result.status).toBe("uncertain");
  return result;
}

test("a charge whose response was lost is recovered on return, without a second charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitWithLostResponse(t);

  // Reloading the page: a fresh browser session only holds the persisted state.
  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);

  const [attempt] = await attemptsOf(t);
  expect(attempt?.status).toBe("pending");
  expect(attempt?.pix?.qrCode).toBeTruthy();
  expect(mpFake.payments.size).toBe(1);
  expect(new Set(createKeys()).size).toBe(1);
});


test("a failed recovery never frees the purchase for another charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitWithLostResponse(t);

  mpFake.respondWith("createPayment", "unauthorized");
  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);
  expect((await attemptsOf(t))[0]?.status).toBe("uncertain");

  mpFake.respondWith("createPayment", "transientFailure");
  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);
  expect((await attemptsOf(t))[0]?.status).toBe("uncertain");
  mpFake.respondWith("createPayment", "transientFailure");
  const blocked = await submit(t);
  expect(blocked.status).toBe("uncertain");
  expect(blocked.message).toMatch(/verificando/);
  expect(mpFake.payments.size).toBe(1);
});

test("recovering twice leaves the same attempt and the same charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitWithLostResponse(t);

  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);
  const first = await attemptsOf(t);
  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);

  expect(await attemptsOf(t)).toEqual(first);
  expect(mpFake.payments.size).toBe(1);
});

test("a late approval after a lost response makes one Official Payment and recovery adds nothing", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await submitWithLostResponse(t);
  const [payment] = [...mpFake.payments.values()];

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: payment!.id,
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
  });
  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);

  const voucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "BRICK1"))
      .unique(),
  );
  expect(voucher?.status).toBe("valid");
  const official = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("isOfficial"), true))
      .collect(),
  );
  expect(official).toHaveLength(1);
  expect(mpFake.payments.size).toBe(1);
  expect(createKeys()).toHaveLength(1);
});

test("an approval found by recovery is confirmed through the idempotent flow", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({ status: "approved", statusDetail: "accredited" });
  mpFake.respondWith("createPayment", "lostResponse");
  await submit(t);

  vi.setSystemTime(Date.now() + 2 * MINUTE);
  await reconcile(t);

  const voucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "BRICK1"))
      .unique(),
  );
  expect(voucher?.status).toBe("valid");
  expect((await attemptsOf(t))[0]?.status).toBe("approved");
});

test("an attempt still being created by the submitting tab is not retried", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await t.run(async (ctx) => {
    const operationId = await ctx.db.insert("paymentOperations", {
      request: {
        kind: "createPayment",
        externalReference: "BRICK1",
        amountCents: 14000,
        description: "Voucher BRICK1",
        paymentMethodId: "pix",
        payer,
        expiresAt: Date.now() + 30 * MINUTE,
      },
    });
    await ctx.db.insert("paymentAttempts", {
      voucherCode: "BRICK1",
      requestId: "in-flight-1",
      operationId,
      method: "pix",
      status: "creating",
      expiresAt: Date.now() + 30 * MINUTE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await reconcile(t);

  expect(createKeys()).toHaveLength(0);
});

test("resuming after the 16h30 cutoff still refuses a new Pix", async () => {
  const t = createConvexTest();
  vi.setSystemTime(at(TODAY, "16:20:00"));
  await seedVoucher(t, { visitDate: TODAY });
  mpFake.respondWith("createPayment", "badRequest");
  expect((await submit(t)).status).toBe("rejected");

  vi.setSystemTime(at(TODAY, "16:30:00"));
  await expect(submit(t)).rejects.toThrow(/16h30/);
  expect(mpFake.payments.size).toBe(0);
});
