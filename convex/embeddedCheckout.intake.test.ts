/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { createConvexTest } from "./test.setup";

const createCheckoutPreference = vi.fn<(...args: unknown[]) => unknown>();
vi.mock("./lib/mercadopago", () => ({
  createCheckoutPreference: (...args: unknown[]) =>
    createCheckoutPreference(...args),
}));

beforeEach(() => createCheckoutPreference.mockReset());
afterEach(() => vi.unstubAllEnvs());

const inAWeek = () => Date.now() + 7 * 24 * 60 * 60 * 1000;

function purchase(overrides: Record<string, unknown> = {}) {
  return {
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    visitDateMs: inAWeek(),
    ...overrides,
  };
}

test("starting an embedded purchase creates a Pending voucher without a Pro preference", async () => {
  const t = createConvexTest();

  const result = await t.action(api.embeddedCheckout.startPurchase, purchase());

  expect(createCheckoutPreference).not.toHaveBeenCalled();
  const stored = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", result.code))
      .unique(),
  );
  expect(stored).toMatchObject({
    status: "pending",
    managementToken: result.managementToken,
    priceCents: result.priceCents,
  });
  expect(stored?.preferenceId).toBeUndefined();
});

test("the charged price comes from the server, never from the browser", async () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "80");
  const t = createConvexTest();

  const result = await t.action(api.embeddedCheckout.startPurchase, purchase());
  expect(result.priceCents).toBe(16000);

  await expect(
    t.action(
      api.embeddedCheckout.startPurchase,
      purchase({ phone: "11888888888", priceCents: 1 }),
    ),
  ).rejects.toThrow();
});

test("a phone with a live Pending voucher cannot start another purchase", async () => {
  const t = createConvexTest();
  await t.action(api.embeddedCheckout.startPurchase, purchase());

  await expect(
    t.action(api.embeddedCheckout.startPurchase, purchase()),
  ).rejects.toThrow(/compra pendente/);
});
