/// <reference types="vite/client" />
import { beforeEach, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";

let mpFake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", () => ({
  refundPayment: (...args: Parameters<typeof mpFake.api.refundPayment>) =>
    mpFake.api.refundPayment(...args),
  createPayment: (...args: Parameters<typeof mpFake.api.createPayment>) =>
    mpFake.api.createPayment(...args),
}));

const managementToken = crypto.randomUUID();
const inADay = () => Date.now() + 24 * 60 * 60 * 1000;

beforeEach(() => {
  mpFake = createMercadoPagoFake();
});

async function seed(
  t: ReturnType<typeof createConvexTest>,
  overrides: Record<string, unknown> = {},
) {
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
      visitDate: "2099-01-01",
      expiresAt: inADay(),
      isTest: false,
      ...overrides,
    }),
  );
}

function confirm(
  t: ReturnType<typeof createConvexTest>,
  overrides: Record<string, unknown> = {},
) {
  return t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
    paymentTypeId: "bank_transfer",
    paymentMethodId: "pix",
    ...overrides,
  });
}

const voucherOf = (t: ReturnType<typeof createConvexTest>) =>
  t.run((ctx) => ctx.db.query("vouchers").first());

test("an approved Pix for the base price in BRL makes the embedded Voucher valid and settles the attempt", async () => {
  const t = createConvexTest();
  await seed(t);
  await t.action(api.paymentAttempts.submitPixPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "pix",
    payer: { email: "visitante@example.com" },
  });

  const result = await confirm(t, { paymentId: "pay-1" });

  expect(result).toMatchObject({ outcome: "updated", becameValid: true });
  expect(await voucherOf(t)).toMatchObject({ status: "valid" });
  const attempt = await t.run((ctx) =>
    ctx.db.query("paymentAttempts").first(),
  );
  expect(attempt?.status).toBe("approved");
});

test.each([
  { name: "a different amount", overrides: { paymentAmountCents: 13000 } },
  { name: "a different currency", overrides: { paymentCurrency: "USD" } },
  { name: "a missing amount", overrides: { paymentAmountCents: undefined } },
  { name: "a missing currency", overrides: { paymentCurrency: undefined } },
])(
  "an approval with $name does not release an embedded Voucher and is refunded",
  async ({ overrides }) => {
    const t = createConvexTest();
    await seed(t);
    mpFake.payments.set("pay-1", {
      id: "pay-1",
      status: "approved",
      externalReference: "BRICK1",
      amount: 130,
      refundedAmount: 0,
    });

    const result = await confirm(t, overrides);

    expect(result).toMatchObject({ becameValid: false });
    expect(await voucherOf(t)).toMatchObject({ status: "pending" });
    const payment = await t.run((ctx) => ctx.db.query("payments").first());
    expect(payment).toMatchObject({ isOfficial: false, owesRefund: true });
    const refunds = await t.run((ctx) => ctx.db.query("paymentRefunds").collect());
    expect(refunds).toHaveLength(1);
  },
);

test("a repeated or out-of-order notification releases entry only once", async () => {
  const t = createConvexTest();
  await seed(t);

  await confirm(t, { paymentId: "pay-1" });
  const repeated = await confirm(t, { paymentId: "pay-1" });
  const secondApproval = await confirm(t, { paymentId: "pay-2" });
  // A stale "pending" update arriving after the approval changes nothing.
  await confirm(t, { paymentId: "pay-1", paymentStatus: "pending" });

  expect(repeated).toMatchObject({ becameValid: false });
  expect(secondApproval).toMatchObject({ becameValid: false });
  expect(await voucherOf(t)).toMatchObject({
    status: "valid",
    paymentId: "pay-1",
  });
  const official = await t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_voucherCode_and_isOfficial", (q) =>
        q.eq("voucherCode", "BRICK1").eq("isOfficial", true),
      )
      .collect(),
  );
  expect(official).toHaveLength(1);
  expect(
    await t.run((ctx) => ctx.db.query("paymentRefunds").collect()),
  ).toHaveLength(1);
});

test("an approval after the purchase was cancelled follows the existing refund path", async () => {
  const t = createConvexTest();
  await seed(t, { status: "cancelled" });

  const result = await confirm(t);

  expect(result).toMatchObject({ becameValid: false });
  expect(await voucherOf(t)).toMatchObject({ status: "cancelled" });
  expect(
    await t.run((ctx) => ctx.db.query("paymentRefunds").collect()),
  ).toHaveLength(1);
});

test("a Checkout Pro voucher confirms exactly as before, whatever amount detail the notification carries", async () => {
  const t = createConvexTest();
  await seed(t, { preferenceId: "pref-1" });

  const result = await confirm(t, {
    paymentAmountCents: 12345,
    paymentCurrency: undefined,
  });

  expect(result).toMatchObject({ becameValid: true });
});
