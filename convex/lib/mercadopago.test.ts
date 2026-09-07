/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createCheckoutPreference } from "./mercadopago";

const originalFetch = global.fetch;
const originalToken = process.env.MERCADOPAGO_TOKEN;

beforeEach(() => {
  process.env.MERCADOPAGO_TOKEN = "test-token";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.MERCADOPAGO_TOKEN = originalToken;
});

test("marks the checkout item as a service so Mercado Pago skips shipping guarantees", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({ id: "pref-1", init_point: "https://mp.example/pref-1" }),
      { status: 200 },
    ),
  );
  global.fetch = fetchMock as unknown as typeof fetch;

  await createCheckoutPreference({
    code: "ABC123",
    description: "Voucher de entrada",
    priceCents: 5000,
    name: "Visitante",
    surname: "Teste",
    phone: "11999999999",
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  const body = JSON.parse(requestInit.body as string) as {
    items: Array<{ category_id?: string }>;
  };

  expect(body.items[0]?.category_id).toBe("services");
});
