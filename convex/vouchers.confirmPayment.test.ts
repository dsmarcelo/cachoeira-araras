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
    status: "pending" as
      | "pending"
      | "valid"
      | "redeemed"
      | "expired"
      | "refunded"
      | "cancelled",
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

test.each(["refunded", "charged_back", "cancelled"])(
  "a %s notification for an unredeemed valid voucher moves it to refunded and records the reason",
  async (paymentStatus) => {
    const t = convexTest(schema, modules);
    await insertVoucher(t, { status: "valid", paymentId: "pay-1" });

    const result = await t.mutation(internal.vouchers.confirmPayment, {
      code: "a1b2",
      paymentId: "pay-1",
      paymentStatus,
    });

    expect(result).toMatchObject({ outcome: "reversed", becameValid: false });

    const stored = await t.run((ctx) =>
      ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", "a1b2"))
        .unique(),
    );
    expect(stored?.status).toBe("refunded");
    expect(stored?.reversal?.reason).toBe(paymentStatus);
    expect(stored?.reversal?.notedAt).toEqual(expect.any(Number));
  },
);

test.each(["refunded", "charged_back", "cancelled"])(
  "a %s notification for an already-redeemed voucher never reverts the redemption but records an admin warning",
  async (paymentStatus) => {
    const t = convexTest(schema, modules);
    await insertVoucher(t, { status: "redeemed", paymentId: "pay-1" });

    const result = await t.mutation(internal.vouchers.confirmPayment, {
      code: "a1b2",
      paymentId: "pay-1",
      paymentStatus,
    });

    expect(result).toMatchObject({ outcome: "redeemed", becameValid: false });

    const stored = await t.run((ctx) =>
      ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", "a1b2"))
        .unique(),
    );
    expect(stored?.status).toBe("redeemed");
    expect(stored?.reversal?.reason).toBe(paymentStatus);
    expect(stored?.reversal?.notedAt).toEqual(expect.any(Number));
  },
);

test("a repeated negative-terminal notification for an already-refunded voucher is idempotent", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { status: "valid", paymentId: "pay-1" });

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "refunded",
  });
  const firstStored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "charged_back",
  });

  expect(result).toMatchObject({
    outcome: "already_processed",
    becameValid: false,
  });

  const secondStored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  // The original reason and timestamp are never overwritten by a later
  // delivery, whatever new reason it carries.
  expect(secondStored?.status).toBe("refunded");
  expect(secondStored?.reversal).toEqual(firstStored?.reversal);
});

test("a repeated negative-terminal notification for an already-flagged redeemed voucher does not overwrite the original warning", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { status: "redeemed", paymentId: "pay-1" });

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "refunded",
  });
  const firstStored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "charged_back",
  });

  expect(result).toMatchObject({ outcome: "redeemed", becameValid: false });

  const secondStored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique(),
  );
  expect(secondStored?.status).toBe("redeemed");
  expect(secondStored?.reversal).toEqual(firstStored?.reversal);
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

test("payments are stored one per record and are unique by Mercado Pago payment identifier", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "pay-uniq" });

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "pay-uniq",
    paymentId: "mp-pay-100",
    paymentStatus: "approved",
  });

  const paymentsFirst = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_voucherCode", (q) => q.eq("voucherCode", "pay-uniq"))
      .collect(),
  );
  expect(paymentsFirst).toHaveLength(1);
  expect(paymentsFirst[0]).toMatchObject({
    paymentId: "mp-pay-100",
    voucherCode: "pay-uniq",
    status: "approved",
    isOfficial: true,
    owesRefund: false,
  });

  // Redelivery of the exact same paymentId
  await t.mutation(internal.vouchers.confirmPayment, {
    code: "pay-uniq",
    paymentId: "mp-pay-100",
    paymentStatus: "approved",
  });

  const paymentsSecond = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_voucherCode", (q) => q.eq("voucherCode", "pay-uniq"))
      .collect(),
  );
  expect(paymentsSecond).toHaveLength(1);
});

test("two concurrent approvals produce exactly one Official Payment and one Excess Payment", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "race-code" });

  const [res1, res2] = await Promise.all([
    t.mutation(internal.vouchers.confirmPayment, {
      code: "race-code",
      paymentId: "race-pay-1",
      paymentStatus: "approved",
    }),
    t.mutation(internal.vouchers.confirmPayment, {
      code: "race-code",
      paymentId: "race-pay-2",
      paymentStatus: "approved",
    }),
  ]);

  const outcomes = [res1, res2];
  const becameValidCount = outcomes.filter((r) => r.becameValid).length;
  expect(becameValidCount).toBe(1);

  const storedVoucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "race-code"))
      .unique(),
  );
  expect(storedVoucher?.status).toBe("valid");

  const storedPayments = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_voucherCode", (q) => q.eq("voucherCode", "race-code"))
      .collect(),
  );
  expect(storedPayments).toHaveLength(2);

  const officialPayments = storedPayments.filter((p) => p.isOfficial);
  const excessPayments = storedPayments.filter((p) => !p.isOfficial);

  expect(officialPayments).toHaveLength(1);
  expect(officialPayments[0]?.owesRefund).toBe(false);
  expect(officialPayments[0]?.paymentId).toBe(storedVoucher?.paymentId);

  expect(excessPayments).toHaveLength(1);
  expect(excessPayments[0]?.owesRefund).toBe(true);
});

test("a repeated webhook for an excess payment identifier changes nothing and reports no new conversion", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "excess-repeat", status: "valid", paymentId: "official-1" });

  // First delivery of excess payment
  const firstResult = await t.mutation(internal.vouchers.confirmPayment, {
    code: "excess-repeat",
    paymentId: "excess-pay-1",
    paymentStatus: "approved",
  });
  expect(firstResult).toMatchObject({
    outcome: "updated",
    becameValid: false,
  });

  // Second delivery of the same excess payment
  const secondResult = await t.mutation(internal.vouchers.confirmPayment, {
    code: "excess-repeat",
    paymentId: "excess-pay-1",
    paymentStatus: "approved",
  });
  expect(secondResult).toMatchObject({
    outcome: "already_processed",
    becameValid: false,
  });

  const storedPayments = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", "excess-pay-1"))
      .collect(),
  );
  expect(storedPayments).toHaveLength(1);
});

test.each(["valid", "redeemed", "expired", "cancelled"] as const)(
  "an approval arriving after the Voucher is %s is recorded as an Excess Payment and leaves the Voucher untouched",
  async (voucherStatus) => {
    const t = convexTest(schema, modules);
    const initialPaymentId = voucherStatus === "valid" || voucherStatus === "redeemed"
      ? "official-pay-id"
      : undefined;

    await insertVoucher(t, {
      code: `voucher-${voucherStatus}`,
      status: voucherStatus,
      paymentId: initialPaymentId,
    });

    const result = await t.mutation(internal.vouchers.confirmPayment, {
      code: `voucher-${voucherStatus}`,
      paymentId: "excess-pay-new",
      paymentStatus: "approved",
    });

    expect(result).toMatchObject({
      outcome: "updated",
      becameValid: false,
    });

    // Voucher is left untouched
    const storedVoucher = await t.run((ctx) =>
      ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", `voucher-${voucherStatus}`))
        .unique(),
    );
    expect(storedVoucher?.status).toBe(voucherStatus);
    expect(storedVoucher?.paymentId).toBe(initialPaymentId);

    // Payment is stored as Excess Payment owing a refund
    const storedPayment = await t.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", "excess-pay-new"))
        .unique(),
    );
    expect(storedPayment).toMatchObject({
      paymentId: "excess-pay-new",
      voucherCode: `voucher-${voucherStatus}`,
      status: "approved",
      isOfficial: false,
      owesRefund: true,
    });
  },
);

test("an approval arriving for an overdue pending voucher is recorded as an Excess Payment and does not validate the voucher", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, {
    code: "overdue-pend",
    status: "pending",
    expiresAt: Date.now() - 1000,
  });

  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "overdue-pend",
    paymentId: "late-pay",
    paymentStatus: "approved",
  });

  expect(result).toMatchObject({
    outcome: "updated",
    becameValid: false,
  });

  const storedVoucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "overdue-pend"))
      .unique(),
  );
  expect(storedVoucher?.status).toBe("pending");

  const storedPayment = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", "late-pay"))
      .unique(),
  );
  expect(storedPayment).toMatchObject({
    isOfficial: false,
    owesRefund: true,
  });
});

test("the admin payments listing and voucher enrichment continue to resolve the Official Payment", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, {
    code: "enrich-test",
    name: "Carlos Silva",
    phone: "11988887777",
    status: "valid",
    paymentId: "official-enrich-pay",
  });

  // Record an official payment and an excess payment
  await t.run(async (ctx) => {
    await ctx.db.insert("payments", {
      paymentId: "official-enrich-pay",
      voucherCode: "enrich-test",
      status: "approved",
      isOfficial: true,
      owesRefund: false,
      createdAt: Date.now() - 1000,
    });
    await ctx.db.insert("payments", {
      paymentId: "excess-enrich-pay",
      voucherCode: "enrich-test",
      status: "approved",
      isOfficial: false,
      owesRefund: true,
      createdAt: Date.now(),
    });
  });

  // Querying by code resolves Official Payment
  const byCode = await t.query(internal.vouchers.findForPaymentEnrichment, {
    codes: ["enrich-test"],
    paymentIds: [],
  });
  expect(byCode).toHaveLength(1);
  expect(byCode[0]?.paymentId).toBe("official-enrich-pay");

  // Querying by official paymentId resolves Official Payment
  const byOfficialPayId = await t.query(internal.vouchers.findForPaymentEnrichment, {
    codes: [],
    paymentIds: ["official-enrich-pay"],
  });
  expect(byOfficialPayId).toHaveLength(1);
  expect(byOfficialPayId[0]?.paymentId).toBe("official-enrich-pay");

  // Querying by excess paymentId ALSO resolves the voucher with its Official Payment pointer
  const byExcessPayId = await t.query(internal.vouchers.findForPaymentEnrichment, {
    codes: [],
    paymentIds: ["excess-enrich-pay"],
  });
  expect(byExcessPayId).toHaveLength(1);
  expect(byExcessPayId[0]?.paymentId).toBe("official-enrich-pay");
  expect(byExcessPayId[0]?.code).toBe("enrich-test");
});

test("reversal of an excess payment marks it no longer owing refund and leaves the valid voucher untouched", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, {
    code: "excess-rev",
    status: "valid",
    paymentId: "official-rev-pay",
  });

  // First, receive an excess payment
  await t.mutation(internal.vouchers.confirmPayment, {
    code: "excess-rev",
    paymentId: "excess-rev-pay",
    paymentStatus: "approved",
  });

  // Now, receive a refund for the excess payment
  const result = await t.mutation(internal.vouchers.confirmPayment, {
    code: "excess-rev",
    paymentId: "excess-rev-pay",
    paymentStatus: "refunded",
  });

  expect(result).toMatchObject({
    outcome: "updated",
    becameValid: false,
  });

  // Voucher remains valid and unaffected
  const storedVoucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "excess-rev"))
      .unique(),
  );
  expect(storedVoucher?.status).toBe("valid");
  expect(storedVoucher?.reversal).toBeUndefined();

  // Excess payment status updated, owesRefund is false
  const storedPayment = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", "excess-rev-pay"))
      .unique(),
  );
  expect(storedPayment?.status).toBe("refunded");
  expect(storedPayment?.owesRefund).toBe(false);
});

