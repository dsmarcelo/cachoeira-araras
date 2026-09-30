/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

// Sao Paulo is a fixed UTC-3.
const at = (date: string, time: string) =>
  new Date(`${date}T${time}-03:00`).getTime();
const TODAY = "2026-09-30";
const TOMORROW = "2026-10-01";

const managementToken = crypto.randomUUID();
const payer = {
  email: "visitante@example.com",
  identification: { type: "CPF", number: "12345678909" },
};

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

function payByCard(
  t: ReturnType<typeof createConvexTest>,
  overrides: Record<string, unknown> = {},
) {
  return t.action(api.paymentAttempts.submitCardPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "visa",
    token: "card-token-1",
    installments: 1,
    payer,
    ...overrides,
  });
}

function payByPix(t: ReturnType<typeof createConvexTest>) {
  return t.action(api.paymentAttempts.submitPixPayment, {
    code: "BRICK1",
    managementToken,
    requestId: crypto.randomUUID(),
    paymentMethodId: "pix",
    payer,
  });
}

const attemptsOf = (t: ReturnType<typeof createConvexTest>) =>
  t.run((ctx) => ctx.db.query("paymentAttempts").collect());

const checkoutOf = async (t: ReturnType<typeof createConvexTest>) => {
  const checkout = await t.query(api.paymentAttempts.getCheckout, {
    code: "BRICK1",
    managementToken,
  });
  if (checkout.kind !== "ok") throw new Error("expected checkout");
  return checkout;
};

test("an approved card charges the server price even when paid in installments", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  const result = await payByCard(t, { installments: 6 });

  expect(result.status).toBe("approved");
  expect(mpFake.payments.size).toBe(1);
  expect([...mpFake.payments.values()][0]).toMatchObject({
    externalReference: "BRICK1",
    amount: 140,
    currency: "BRL",
  });
  const [attempt] = await attemptsOf(t);
  expect(attempt).toMatchObject({ method: "card", status: "approved" });
  expect(attempt?.expiresAt).toBeUndefined();
});

test("an approved card attempt does not make the Voucher valid until confirmed", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  await payByCard(t);

  const before = await t.run((ctx) => ctx.db.query("vouchers").first());
  expect(before?.status).toBe("pending");

  const confirmation = await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
    paymentTypeId: "credit_card",
    paymentMethodId: "visa",
  });
  expect(confirmation).toMatchObject({ becameValid: true });
});

test("a declined card explains why and allows another try on the same Voucher and price", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({
    status: "rejected",
    statusDetail: "cc_rejected_insufficient_amount",
  });

  const declined = await payByCard(t);
  expect(declined.status).toBe("rejected");
  expect(declined.message).toMatch(/saldo/i);
  expect(JSON.stringify(await checkoutOf(t))).toMatch(/saldo/i);

  const retry = await payByCard(t, { token: "card-token-2" });
  expect(retry.status).toBe("approved");
  const payments = [...mpFake.payments.values()];
  expect(payments).toHaveLength(2);
  expect(payments.map((p) => [p.externalReference, p.amount])).toEqual([
    ["BRICK1", 140],
    ["BRICK1", 140],
  ]);
  const voucher = await t.run((ctx) => ctx.db.query("vouchers").first());
  expect(voucher).toMatchObject({ code: "BRICK1", priceCents: 14000 });
});

test("a card that needs bank authentication exposes the challenge and blocks other charges", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({
    status: "pending",
    statusDetail: "pending_challenge",
    challenge: { externalResourceUrl: "https://bank.example/3ds", creq: "abc" },
  });

  const result = await payByCard(t);

  expect(result.status).toBe("pending");
  const checkout = await checkoutOf(t);
  expect(checkout.attempt).toMatchObject({
    status: "pending",
    method: "card",
    challenge: { externalResourceUrl: "https://bank.example/3ds", creq: "abc" },
  });
  await expect(payByCard(t)).rejects.toThrow(/em andamento/);
  await expect(payByPix(t)).rejects.toThrow(/em andamento/);
  expect(mpFake.payments.size).toBe(1);
});

test("a failed bank authentication ends the attempt and frees a new one", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({
    status: "pending",
    statusDetail: "pending_challenge",
    challenge: { externalResourceUrl: "https://bank.example/3ds", creq: "abc" },
  });
  await payByCard(t);

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "rejected",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
  });

  const checkout = await checkoutOf(t);
  expect(checkout.attempt?.status).toBe("rejected");
  expect(checkout.attempt?.challenge).toBeUndefined();
  expect((await payByCard(t)).status).toBe("approved");
});

test("a card under review is not declined and blocks another charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.createNext({
    status: "in_process",
    statusDetail: "pending_review_manual",
  });

  expect((await payByCard(t)).status).toBe("in_process");
  await expect(payByCard(t)).rejects.toThrow(/em andamento/);
});

test("a lost provider response is uncertain and blocks any other charge until recovered", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "lostResponse");
  const requestId = crypto.randomUUID();

  expect((await payByCard(t, { requestId })).status).toBe("uncertain");
  await expect(payByCard(t)).rejects.toThrow(/verificando/);
  await expect(payByPix(t)).rejects.toThrow(/verificando/);

  const recovered = await payByCard(t, { requestId });
  expect(recovered.status).toBe("approved");
  expect(mpFake.payments.size).toBe(1);
});

test("a provider refusal of the request is corrigible, with card wording", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "badRequest");

  const refused = await payByCard(t);

  expect(refused.status).toBe("rejected");
  expect(refused.message).toMatch(/cartão/i);
  expect((await payByCard(t)).status).toBe("approved");
});

test("resending the same card request reuses the same charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  const requestId = crypto.randomUUID();

  await payByCard(t, { requestId });
  await payByCard(t, { requestId });

  expect(mpFake.payments.size).toBe(1);
  expect(await attemptsOf(t)).toHaveLength(1);
});

test("concurrent card submissions from two tabs create only one charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  const results = await Promise.allSettled([payByCard(t), payByCard(t)]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(mpFake.payments.size).toBe(1);
});

test("invalid card requests and missing authorization never reach the provider", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  await expect(
    payByCard(t, { managementToken: crypto.randomUUID() }),
  ).rejects.toThrow(/navegador original/);
  await expect(payByCard(t, { token: "" })).rejects.toThrow(/cartão/i);
  await expect(payByCard(t, { installments: 0 })).rejects.toThrow(/parcel/i);
  await expect(payByCard(t, { installments: 99 })).rejects.toThrow(/parcel/i);
  await expect(payByCard(t, { paymentMethodId: "pix" })).rejects.toThrow(
    /cartão/i,
  );
  await expect(payByCard(t, { payer: { email: "nope" } })).rejects.toThrow(
    /e-mail/,
  );
  expect(mpFake.attempts).toHaveLength(0);
  expect(await attemptsOf(t)).toHaveLength(0);
});

test("Voucher states that cannot be paid never reach the provider by card", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { status: "cancelled" });
  await expect(payByCard(t)).rejects.toThrow(/cancelada/);

  const t2 = createConvexTest();
  await seedVoucher(t2, { preferenceId: "pref-1" });
  await expect(payByCard(t2)).rejects.toThrow(/outro checkout/);
  expect(mpFake.attempts).toHaveLength(0);
});

test("same-day cards are accepted until 16:59:59 and refused from 17:00:00", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  vi.setSystemTime(at(TODAY, "16:59:59"));
  expect((await payByCard(t)).status).toBe("approved");

  const t2 = createConvexTest();
  await seedVoucher(t2, { visitDate: TODAY });
  for (const time of ["17:00:00", "17:00:01"]) {
    vi.setSystemTime(at(TODAY, time));
    await expect(payByCard(t2)).rejects.toThrow(/17h/);
  }
  expect(await attemptsOf(t2)).toHaveLength(0);
});

test("between 16:30 and 17:00 the same-day visit can still pay by card but not by Pix", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  vi.setSystemTime(at(TODAY, "16:45:00"));

  await expect(payByPix(t)).rejects.toThrow(/16h30/);
  const checkout = await checkoutOf(t);
  expect(checkout.pixCutoffAt).toBe(at(TODAY, "16:30:00"));
  expect(checkout.cardCutoffAt).toBe(at(TODAY, "17:00:00"));
  expect((await payByCard(t)).status).toBe("approved");
});

test("a future visit is not limited by the same-day card cutoff", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TOMORROW });
  vi.setSystemTime(at(TODAY, "20:00:00"));

  expect((await payByCard(t)).status).toBe("approved");
  expect((await checkoutOf(t)).cardCutoffAt).toBeNull();
});

test("a late notification for an attempt made before the cutoff is still accepted", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  vi.setSystemTime(at(TODAY, "16:59:00"));
  mpFake.createNext({ status: "in_process" });
  await payByCard(t);

  vi.setSystemTime(at(TODAY, "17:20:00"));
  const confirmation = await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
    paymentTypeId: "credit_card",
    paymentMethodId: "visa",
  });
  expect(confirmation).toMatchObject({ becameValid: true });
});
