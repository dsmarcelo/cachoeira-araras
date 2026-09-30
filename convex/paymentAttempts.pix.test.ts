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

test("submitting Pix creates one charge for the server price, referenced by the Voucher Code", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  const result = await submit(t);

  expect(result.status).toBe("pending");
  expect(mpFake.payments.size).toBe(1);
  expect([...mpFake.payments.values()][0]).toMatchObject({
    externalReference: "BRICK1",
    amount: 140,
  });
  const [attempt] = await attemptsOf(t);
  expect(attempt).toMatchObject({
    voucherCode: "BRICK1",
    method: "pix",
    status: "pending",
  });
  expect(attempt?.pix?.qrCode).toBeTruthy();
});

test("the Pix code is presented with QR data and a 30 minute deadline, without payer data", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  const now = Date.now();
  await submit(t);

  const checkout = await t.query(api.paymentAttempts.getCheckout, {
    code: "BRICK1",
    managementToken,
  });

  if (checkout.kind !== "ok") throw new Error("expected checkout");
  expect(checkout.attempt?.pix?.qrCodeBase64).toBeTruthy();
  const ttl = (checkout.attempt?.expiresAt ?? 0) - now;
  expect(ttl).toBeGreaterThanOrEqual(30 * MINUTE);
  expect(ttl).toBeLessThan(31 * MINUTE);
  expect(JSON.stringify(checkout)).not.toContain(payer.email);
});

test("without the management token nothing is charged", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  await expect(
    submit(t, { managementToken: crypto.randomUUID() }),
  ).rejects.toThrow(/navegador original/);
  expect(mpFake.attempts).toHaveLength(0);
  expect(await attemptsOf(t)).toHaveLength(0);
});

test("resending the same request reuses the same charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  const requestId = crypto.randomUUID();

  await submit(t, { requestId });
  await submit(t, { requestId });

  expect(mpFake.payments.size).toBe(1);
  expect(await attemptsOf(t)).toHaveLength(1);
});

test("concurrent submissions from two tabs create only one charge", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  const results = await Promise.allSettled([submit(t), submit(t)]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(mpFake.payments.size).toBe(1);
  expect(await attemptsOf(t)).toHaveLength(1);
});

test("a lost provider response leaves an uncertain attempt that blocks another charge while it cannot be checked", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "lostResponse", "transientFailure");

  const first = await submit(t);
  expect(first.status).toBe("uncertain");

  const second = await submit(t);
  expect(second.status).toBe("uncertain");
  expect(second.message).toMatch(/verificando/);
  expect(mpFake.payments.size).toBe(1);
});

test("resending an uncertain request recovers the original charge instead of creating another", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "lostResponse");
  const requestId = crypto.randomUUID();
  await submit(t, { requestId });

  const recovered = await submit(t, { requestId });

  expect(recovered.status).toBe("pending");
  expect(mpFake.payments.size).toBe(1);
  expect(new Set(mpFake.attempts.map((a) => a.key)).size).toBe(1);
});

test("a request the provider refuses outright can be corrected and sent again", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "badRequest");

  const refused = await submit(t);
  expect(refused.status).toBe("rejected");
  expect(refused.message).toMatch(/Pix/);

  const retry = await submit(t);
  expect(retry.status).toBe("pending");
  expect(mpFake.payments.size).toBe(1);
});

test("a provider credential fault is a technical failure, not a buyer data refusal", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  mpFake.respondWith("createPayment", "unauthorized");

  const result = await submit(t);

  expect(result.status).toBe("uncertain");
  expect(result.message).toMatch(/problema técnico/);
  expect(result.message).not.toMatch(/Confira/);
  expect((await attemptsOf(t))[0]?.status).toBe("uncertain");
  mpFake.respondWith("createPayment", "unauthorized");
  expect((await submit(t)).status).toBe("uncertain");
});

test("Voucher states that cannot be paid never reach the provider", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { status: "cancelled" });
  await expect(submit(t)).rejects.toThrow(/cancelada/);

  await t.run(async (ctx) => {
    const v = await ctx.db.query("vouchers").first();
    await ctx.db.patch(v!._id, {
      status: "pending",
      cancellationStartedAt: Date.now(),
    });
  });
  await expect(submit(t)).rejects.toThrow(/cancelamento/);

  await t.run(async (ctx) => {
    const v = await ctx.db.query("vouchers").first();
    await ctx.db.patch(v!._id, { cancellationStartedAt: undefined });
    await ctx.db.insert("payments", {
      paymentId: "official-1",
      voucherCode: "BRICK1",
      status: "approved",
      isOfficial: true,
      owesRefund: false,
      createdAt: Date.now(),
    });
  });
  await expect(submit(t)).rejects.toThrow(/já foi aprovado/);
  expect(mpFake.attempts).toHaveLength(0);
});

test("a Checkout Pro voucher is not charged through the embedded checkout", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { preferenceId: "pref-1" });

  await expect(submit(t)).rejects.toThrow(/outro checkout/);
  expect(mpFake.attempts).toHaveLength(0);
});

test("only Pix is available in this checkout and the payer email is validated", async () => {
  const t = createConvexTest();
  await seedVoucher(t);

  await expect(submit(t, { paymentMethodId: "visa" })).rejects.toThrow(
    /meio de pagamento/,
  );
  await expect(submit(t, { payer: { email: "not-an-email" } })).rejects.toThrow(
    /e-mail/,
  );
  expect(mpFake.attempts).toHaveLength(0);
});

test("a Pix lives 30 minutes plus the provider margin, never cut short by the same-day deadline", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  const created = at(TODAY, "10:00:00");
  await submit(t);
  expect((await attemptsOf(t))[0]!.expiresAt).toBe(
    created + 30 * 60_000 + 10_000,
  );
});

test("the last same-day Pix still gets its full life and ends before 17:00", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  vi.setSystemTime(at(TODAY, "16:29:49"));
  await submit(t);
  expect((await attemptsOf(t))[0]!.expiresAt).toBe(at(TODAY, "16:59:59"));
});

test("a Pix created before the cutoff can still be confirmed after 16:30 and after 17:00", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  vi.setSystemTime(at(TODAY, "16:29:00"));
  expect((await submit(t)).status).toBe("pending");

  for (const time of ["16:30:30", "17:05:00"]) {
    vi.setSystemTime(at(TODAY, time));
    const checkout = await t.query(api.paymentAttempts.getCheckout, {
      code: "BRICK1",
      managementToken,
    });
    expect(checkout).toMatchObject({ attempt: { status: "pending" } });
  }
  const confirmation = await t.mutation(internal.vouchers.confirmPayment, {
    code: "BRICK1",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentAmountCents: 14000,
    paymentCurrency: "BRL",
    paymentTypeId: "bank_transfer",
    paymentMethodId: "pix",
  });
  expect(confirmation).toMatchObject({ becameValid: true });
});

test("same-day visits get a Pix until 16:29:49 and none from 16:29:50", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });

  vi.setSystemTime(at(TODAY, "16:29:49"));
  expect((await submit(t)).status).toBe("pending");

  const t2 = createConvexTest();
  await seedVoucher(t2, { visitDate: TODAY });
  for (const time of ["16:29:50", "16:30:01"]) {
    vi.setSystemTime(at(TODAY, time));
    await expect(submit(t2)).rejects.toThrow(/16h30/);
  }
  expect(await attemptsOf(t2)).toHaveLength(0);
});

test("a Pix for a future visit is not limited by the same-day cutoff", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TOMORROW });
  vi.setSystemTime(at(TODAY, "18:00:00"));

  expect((await submit(t)).status).toBe("pending");
});

test("the Pix deadline does not change the Voucher, which stays Pending", async () => {
  const t = createConvexTest();
  await seedVoucher(t, { visitDate: TODAY });
  await submit(t);
  vi.setSystemTime(at(TODAY, "12:00:00"));

  const voucher = await t.run((ctx) => ctx.db.query("vouchers").first());
  expect(voucher).toMatchObject({
    status: "pending",
    visitDate: TODAY,
    expiresAt: at(TODAY, "23:59:59"),
  });
});

test("the intent is persisted before the provider is called", async () => {
  const t = createConvexTest();
  await seedVoucher(t);
  const seen: string[] = [];
  const original = mpFake.api.createPayment;
  mpFake.api.createPayment = async (...args) => {
    const attempts = await attemptsOf(t);
    seen.push(...attempts.map((a) => a.status));
    return original(...args);
  };

  await submit(t);

  expect(seen).toEqual(["creating"]);
});
