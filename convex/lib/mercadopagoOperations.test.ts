import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cancelPayment,
  findPaymentsByExternalReference,
  invalidatePreference,
  refundPayment,
} from "./mercadopagoOperations";

const intent = {
  idempotencyKey: "mp-recorded-intent",
  recordedAt: Date.parse("2026-09-01T12:00:00Z"),
};
const payment = {
  id: 123,
  status: "pending",
  external_reference: "ABC123",
  transaction_amount: 50,
};
const calls: Array<{ url: string; init: RequestInit }> = [];
let replies: unknown[];

beforeEach(() => {
  vi.stubEnv("MERCADOPAGO_TOKEN", "test-token");
  calls.length = 0;
  replies = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    if (reply === undefined) throw new Error("Unexpected provider request");
    return Response.json(reply);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("full refund retry sends no partial amount and preserves provider idempotency", async () => {
  replies = [
    new Error("Lost response"),
    { id: 9, status: "approved", amount: 50 },
  ];
  await expect(refundPayment("123", intent)).rejects.toThrow("Lost response");
  expect(await refundPayment("123", intent)).toEqual({
    id: "9",
    status: "approved",
    amount: 50,
  });
  expect(calls).toHaveLength(2);
  for (const call of calls) {
    expect(call.url).toBe(
      "https://api.mercadopago.com/v1/payments/123/refunds",
    );
    expect(call.init).toMatchObject({
      method: "POST",
      body: "{}",
      headers: { "X-Idempotency-Key": "mp-recorded-intent" },
    });
  }
});

test("preference invalidation expires the window and a retry recognizes the expired preference", async () => {
  const expired = {
    id: "pref-1",
    expires: true,
    expiration_date_to: "2026-09-01T11:59:59.000Z",
  };
  replies = [
    { id: "pref-1", expires: false, expiration_date_to: null },
    new Error("Lost response"),
    expired,
  ];
  await expect(invalidatePreference("pref-1", intent)).rejects.toThrow(
    "Lost response",
  );
  expect(await invalidatePreference("pref-1", intent)).toEqual({
    id: "pref-1",
    invalidated: true,
  });
  expect(calls.filter((c) => c.init.method === "PUT")).toHaveLength(1);
  expect(JSON.parse(calls[1]!.init.body as string)).toEqual({
    expires: true,
    expiration_date_from: "2026-09-01T11:59:58.000Z",
    expiration_date_to: "2026-09-01T11:59:59.000Z",
  });
  for (const call of calls)
    expect(call.init.headers).toMatchObject({
      "X-Idempotency-Key": "mp-recorded-intent",
    });
});

test.each(["pending", "in_process", "authorized"])(
  "cancels %s and reconciles a lost update response",
  async (status) => {
    replies = [
      { ...payment, status },
      new Error("Lost response"),
      { ...payment, status: "cancelled" },
    ];
    expect(await cancelPayment("123", intent)).toMatchObject({
      id: "123",
      status: "cancelled",
    });
    expect(calls[1]!.init).toMatchObject({
      method: "PUT",
      body: '{"status":"cancelled"}',
    });
    for (const call of calls)
      expect(call.init.headers).toMatchObject({
        "X-Idempotency-Key": "mp-recorded-intent",
      });
  },
);

test("does not cancel an already approved payment", async () => {
  replies = [{ ...payment, status: "approved" }];
  expect(await cancelPayment("123", intent)).toMatchObject({
    status: "approved",
  });
  expect(calls).toHaveLength(1);
});

test("returns an approval racing cancellation instead of claiming cancellation", async () => {
  replies = [
    payment,
    new Response(null, { status: 400 }),
    { ...payment, status: "approved" },
  ];
  expect(await cancelPayment("123", intent)).toMatchObject({
    status: "approved",
  });
});

test("search reads every page without date or status restrictions", async () => {
  replies = [
    {
      paging: { total: 101 },
      results: Array.from({ length: 100 }, (_, id) => ({
        ...payment,
        id: id + 1,
      })),
    },
    {
      paging: { total: 101 },
      results: [{ ...payment, id: 101, status: "approved" }],
    },
  ];
  expect(await findPaymentsByExternalReference("ABC123", intent)).toHaveLength(
    101,
  );
  const urls = calls.map((c) => new URL(c.url));
  expect(urls.map((u) => u.searchParams.get("offset"))).toEqual(["0", "100"]);
  for (const [index, url] of urls.entries()) {
    expect(url.searchParams.get("external_reference")).toBe("ABC123");
    expect(url.searchParams.has("begin_date")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(calls[index]!.init.headers).toMatchObject({
      "X-Idempotency-Key": "mp-recorded-intent",
    });
  }
});

test.each([400, 401, 404, 429, 500])(
  "search treats HTTP %s as failure, never no payments",
  async (status) => {
    replies = [new Response(null, { status })];
    await expect(
      findPaymentsByExternalReference("ABC123", intent),
    ).rejects.toThrow(`Mercado Pago API failed with ${status}`);
  },
);

test.each([
  {},
  { paging: { total: 1 }, results: [] },
  {
    paging: { total: 1 },
    results: [{ ...payment, external_reference: "OTHER" }],
  },
])(
  "search rejects malformed or incomplete provider responses",
  async (reply) => {
    replies = [reply];
    await expect(
      findPaymentsByExternalReference("ABC123", intent),
    ).rejects.toThrow();
  },
);
