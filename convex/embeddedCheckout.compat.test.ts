/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { createConvexTest } from "./test.setup";

const managementToken = crypto.randomUUID();

const base = {
  name: "Visitante Teste",
  phone: "11999991111",
  adults: 1,
  elderly: 0,
  adultsPool: 0,
  elderlyPool: 0,
  priceCents: 7000,
  visitDate: "2026-09-10",
  isTest: false,
} as const;

test("resuming an embedded purchase points to the internal payment page", async () => {
  const t = createConvexTest();
  await t.run((ctx) =>
    ctx.db.insert("vouchers", {
      ...base,
      code: "BRICK1",
      managementToken,
      status: "pending",
      expiresAt: Date.now() + 60_000,
    }),
  );

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "BRICK1",
    managementToken,
  });

  expect(result).toEqual({
    kind: "resumed",
    code: "BRICK1",
    checkoutUrl: "/pagar/BRICK1",
  });
});

test("a Checkout Pro voucher keeps resuming through its saved checkout address", async () => {
  const t = createConvexTest();
  await t.run((ctx) =>
    ctx.db.insert("vouchers", {
      ...base,
      code: "PRO001",
      managementToken,
      status: "pending",
      expiresAt: Date.now() + 60_000,
      preferenceId: "pref-1",
      initPoint: "https://mercadopago.example/PRO001",
    }),
  );

  const result = await t.mutation(api.vouchers.resumePayment, {
    code: "PRO001",
    managementToken,
  });

  expect(result).toMatchObject({
    kind: "resumed",
    checkoutUrl: "https://mercadopago.example/PRO001",
  });
});
