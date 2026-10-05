/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";
import type * as adapter from "./lib/mercadopagoOperations";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let fake: ReturnType<typeof createMercadoPagoFake>;
// Real `chargebackOutcome` is pure, so only the provider read is faked.
vi.mock("./lib/mercadopagoOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof adapter>()),
  findChargebacksByPayment: (paymentId: string) =>
    fake.api.findChargebacksByPayment(paymentId),
}));

const modules = import.meta.glob("./**/*.ts");
const secret = "test-only-shared-secret";
const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET;

beforeEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = secret;
  fake = createMercadoPagoFake();
});
afterEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = previousSecret;
});

const chargebackCase = (coverageApplied: boolean | null) => ({
  id: "cb-1",
  coverageApplied,
  dateCreated: "2026-10-01T00:00:00Z",
  dateLastUpdated: "2026-10-02T00:00:00Z",
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("vouchers", {
      code: "a1b2",
      name: "Visitante Teste",
      phone: "11999999999",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate: "2026-09-10",
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-1",
      isTest: false,
    }),
  );
  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
    statusDetail: "accredited",
  });
  return t;
}

function webhook(t: Awaited<ReturnType<typeof setup>>, body: object) {
  return t.fetch("/webhooks/mercadopago/confirmPayment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify({
      code: "a1b2",
      paymentId: "pay-1",
      paymentStatus: "charged_back",
      statusDetail: "in_process",
      ...body,
    }),
  });
}

function voucher(t: Awaited<ReturnType<typeof setup>>) {
  return t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
}

test("a charged_back webhook whose case was lost refunds the voucher", async () => {
  const t = await setup();
  fake.chargebacks.set("pay-1", [chargebackCase(false)]);

  const response = await webhook(t, {});

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ outcome: "reversed" });
  expect((await voucher(t))?.status).toBe("refunded");
});

test("a charged_back webhook whose case is open flags a dispute and keeps the voucher valid", async () => {
  const t = await setup();
  fake.chargebacks.set("pay-1", [chargebackCase(null)]);

  const response = await webhook(t, {});

  expect(response.status).toBe(200);
  const stored = await voucher(t);
  expect(stored?.status).toBe("valid");
  expect(stored?.paymentIssue?.kind).toBe("dispute");
});

test("a charged_back payment with no case found is a dispute, never a loss", async () => {
  const t = await setup();

  const response = await webhook(t, {});

  expect(response.status).toBe(200);
  const stored = await voucher(t);
  expect(stored?.status).toBe("valid");
  expect(stored?.paymentIssue?.kind).toBe("dispute");
});

test("a failed chargeback lookup changes nothing and fails the webhook", async () => {
  const t = await setup();
  fake.failNext("chargebacks");

  const response = await webhook(t, {});

  expect(response.status).toBe(502);
  const stored = await voucher(t);
  expect(stored?.status).toBe("valid");
  expect(stored?.paymentIssue).toBeUndefined();
  expect(stored?.reversal).toBeUndefined();
});

test("status detail and refunded cents reach the voucher through the webhook", async () => {
  const t = await setup();

  await webhook(t, {
    paymentStatus: "approved",
    statusDetail: "partially_refunded",
    refundedCents: 1500,
  });

  expect((await voucher(t))?.paymentIssue).toMatchObject({
    kind: "partial_refund",
    refundedCents: 1500,
  });
});

test("the webhook rejects a malformed refunded amount", async () => {
  const t = await setup();

  const response = await webhook(t, { refundedCents: 12.5 });

  expect(response.status).toBe(400);
});
