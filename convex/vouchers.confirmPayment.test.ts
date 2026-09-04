/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const testSecret = "test-only-shared-secret";
const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET;

beforeEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = testSecret;
});

afterEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = previousSecret;
});

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "pending" as "pending" | "valid" | "redeemed" | "expired",
    visitDate: "2026-09-10",
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
  };
}

async function insertVoucher(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  const voucher = { ...defaults(), ...overrides };
  await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
  return voucher;
}

function confirmPaymentRequest(
  body: Record<string, unknown>,
  secret: string | undefined,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret !== undefined) {
    headers["x-webhook-secret"] = secret;
  }
  return {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };
}

test("an approved payment flips a Pending voucher to valid", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });

  expect(result).toMatchObject({
    outcome: "updated",
    becameValid: true,
    isTest: false,
  });

  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("valid");
  expect(stored?.paymentId).toBe("pay-1");
});

test("a non-approved payment status records the payment id but leaves the voucher pending", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "in_process",
  });

  expect(result).toMatchObject({ outcome: "updated", becameValid: false });

  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("pending");
  expect(stored?.paymentId).toBe("pay-1");
});

test("a repeated delivery for an already-confirmed voucher changes nothing and reports no new conversion", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { status: "valid", paymentId: "pay-1" });

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });

  expect(result).toMatchObject({
    outcome: "already_processed",
    becameValid: false,
  });
});

test("an already-redeemed voucher is never reverted", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { status: "redeemed", paymentId: "pay-1" });

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });

  expect(result).toMatchObject({ outcome: "redeemed", becameValid: false });

  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("redeemed");
});

test("a Test Voucher reports isTest so the caller suppresses ad conversions", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { isTest: true });

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });

  expect(result).toMatchObject({ becameValid: true, isTest: true });
});

test("a payment for an unknown voucher code reports not_found", async () => {
  const t = convexTest(schema, modules);

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "zzzz",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });

  expect(result).toEqual({ outcome: "not_found" });
});

test("confirmPayment has no public entry point a signed-in caller can reach", () => {
  // There is deliberately no `api.vouchers.confirmPayment` — only
  // `internal.vouchers.confirmPayment`, callable exclusively from other
  // Convex functions (here, the /webhooks/mercadopago/confirmPayment HTTP
  // action). A browser session, admin or not, has no client-callable
  // reference to hit.
  expect("confirmPayment" in api.vouchers).toBe(false);
});

test("the confirmPayment webhook door rejects a request with no shared secret", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/webhooks/mercadopago/confirmPayment",
    confirmPaymentRequest(
      { code: "a1b2", paymentId: "pay-1", paymentStatus: "approved" },
      undefined,
    ),
  );

  expect(response.status).toBe(401);

  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("pending");
});

test("the confirmPayment webhook door rejects a wrong shared secret", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/webhooks/mercadopago/confirmPayment",
    confirmPaymentRequest(
      { code: "a1b2", paymentId: "pay-1", paymentStatus: "approved" },
      "not-the-secret",
    ),
  );

  expect(response.status).toBe(401);
});

test("the confirmPayment webhook door accepts the correct shared secret and confirms the payment", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/webhooks/mercadopago/confirmPayment",
    confirmPaymentRequest(
      { code: "a1b2", paymentId: "pay-1", paymentStatus: "approved" },
      testSecret,
    ),
  );

  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({ outcome: "updated", becameValid: true });

  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(stored?.status).toBe("valid");
});
