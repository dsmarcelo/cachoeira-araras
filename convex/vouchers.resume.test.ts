/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { ConvexError } from "convex/values";
import { createConvexTest } from "./test.setup";

const visitDate = "2026-09-10";

test("resuming a still-pending purchase returns the verified checkout address", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();
  const initPoint = "https://mercadopago.example/checkout/PEND01";

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "PEND01",
      managementToken,
      name: "Visitante Teste",
      phone: "11999991111",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 10000,
      status: "pending",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-pend01",
      initPoint,
      isTest: false,
    });
  });

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "PEND01",
    managementToken,
  });

  expect(result).toEqual({
    kind: "resumed",
    code: "PEND01",
    checkoutUrl: initPoint,
  });
});

test("resuming a voucher whose payment is already approved opens the voucher instead of checkout", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "PAID01",
      managementToken,
      name: "Visitante Pago",
      phone: "11999992222",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "valid",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-paid01",
      paymentId: "pay-123456",
      initPoint: "https://mercadopago.example/checkout/PAID01",
      isTest: false,
    });
  });

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "PAID01",
    managementToken,
  });

  expect(result).toEqual({
    kind: "already_paid",
    code: "PAID01",
    redirectUrl: "/pagamento?external_reference=PAID01",
  });
});

test("resuming a terminal voucher (cancelled) offers no payment action and explains state", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "CANC01",
      managementToken,
      name: "Visitante Cancelado",
      phone: "11999993333",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "cancelled",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-canc01",
      isTest: false,
    });
  });

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "CANC01",
    managementToken,
  });

  expect(result.kind).toBe("terminal");
  if (result.kind === "terminal") {
    expect(result.status).toBe("cancelled");
    expect(result.message).toContain("cancelada");
  }
});

test("resuming an expired voucher offers no payment action and explains state", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "EXP001",
      managementToken,
      name: "Visitante Expirado",
      phone: "11999994444",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate,
      expiresAt: Date.now() - 1000, // already expired
      preferenceId: "pref-exp01",
      isTest: false,
    });
  });

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "EXP001",
    managementToken,
  });

  expect(result.kind).toBe("terminal");
  if (result.kind === "terminal") {
    expect(result.status).toBe("expired");
    expect(result.message).toContain("expirou");
  }
});

test("resuming a voucher mid-cancellation offers no payment action and explains state", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "MIDC01",
      managementToken,
      name: "Visitante Cancelando",
      phone: "11999995555",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-midc01",
      cancellationStartedAt: Date.now(),
      isTest: false,
    });
  });

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "MIDC01",
    managementToken,
  });

  expect(result.kind).toBe("terminal");
  if (result.kind === "terminal") {
    expect(result.status).toBe("cancelling");
    expect(result.message).toContain("cancelamento");
  }
});

test("resuming requires a valid management capability", async () => {
  const t = createConvexTest();
  const correctToken = crypto.randomUUID();
  const attackerToken = crypto.randomUUID();

  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "AUTH01",
      managementToken: correctToken,
      name: "Visitante",
      phone: "11999996666",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-auth01",
      isTest: false,
    });
  });

  await expect(
    t.mutation(api.vouchers.resumePayment, {
      code: "AUTH01",
      managementToken: attackerToken,
    }),
  ).rejects.toThrowError(ConvexError);
});

test("server re-checks the voucher status dynamically; saved address alone is never sufficient", async () => {
  const t = createConvexTest();
  const managementToken = crypto.randomUUID();
  const initPoint = "https://mercadopago.example/checkout/DYN001";

  const voucherId = await t.run(async (ctx) => {
    return ctx.db.insert("vouchers", {
      code: "DYN001",
      managementToken,
      name: "Visitante Dinâmico",
      phone: "11999997777",
      adults: 1,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "pending",
      visitDate,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      preferenceId: "pref-dyn01",
      initPoint,
      isTest: false,
    });
  });

  // First check: still pending, gets checkoutUrl
  const firstResult = await t.mutation(api.vouchers.resumePayment, {
    code: "DYN001",
    managementToken,
  });
  expect(firstResult.kind).toBe("resumed");

  // Payment arrives concurrently
  await t.run(async (ctx) => {
    await ctx.db.patch(voucherId, { status: "valid", paymentId: "pay-dyn01" });
  });

  // Second check: server re-checks and detects approval instead of trusting saved link
  const secondResult = await t.mutation(api.vouchers.resumePayment, {
    code: "DYN001",
    managementToken,
    savedInitPoint: initPoint,
  });
  expect(secondResult.kind).toBe("already_paid");
  if (secondResult.kind === "already_paid") {
    expect(secondResult.redirectUrl).toBe("/pagamento?external_reference=DYN001");
  }
});
