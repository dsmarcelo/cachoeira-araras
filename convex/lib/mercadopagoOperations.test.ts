import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cancelPayment,
  createPayment,
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

test("does not accept a pending refund response as confirmation", async () => {
  replies = [{ id: 9, status: "pending", amount: 50 }];

  await expect(refundPayment("123", intent)).rejects.toThrow();
});

test("preserves the provider's 401 details without exposing the response body", async () => {
  replies = [
    Response.json(
      {
        error: "invalid_token",
        message: "Invalid access token",
        secret: "do-not-log",
      },
      { status: 401 },
    ),
  ];

  await expect(refundPayment("123", intent)).rejects.toMatchObject({
    status: 401,
    providerCode: "invalid_token",
    providerMessage: "Invalid access token",
  });
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
      paging: { total: 51 },
      results: Array.from({ length: 50 }, (_, id) => ({
        ...payment,
        id: id + 1,
      })),
    },
    {
      paging: { total: 51 },
      results: [{ ...payment, id: 51, status: "approved" }],
    },
  ];
  expect(await findPaymentsByExternalReference("ABC123", intent)).toHaveLength(
    51,
  );
  const urls = calls.map((c) => new URL(c.url));
  expect(urls.map((u) => u.searchParams.get("offset"))).toEqual(["0", "50"]);
  for (const [index, url] of urls.entries()) {
    expect(url.searchParams.get("external_reference")).toBe("ABC123");
    expect(url.searchParams.get("limit")).toBe("50");
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

const pixRequest = {
  kind: "createPayment" as const,
  externalReference: "ABC123",
  amountCents: 7050,
  description: "Voucher ABC123",
  paymentMethodId: "pix",
  payer: { email: "visitante@example.com" },
  expiresAt: Date.parse("2026-09-01T12:30:10Z"),
};

test("creating a Pix charge sends the server-owned amount, reference and expiry under the recorded idempotency key", async () => {
  replies = [
    {
      ...payment,
      status: "pending",
      status_detail: "pending_waiting_transfer",
      transaction_amount: 70.5,
      currency_id: "BRL",
      payment_method_id: "pix",
      payment_type_id: "bank_transfer",
      date_of_expiration: "2026-09-01T12:30:10.000+00:00",
      point_of_interaction: {
        transaction_data: { qr_code: "000201pix", qr_code_base64: "iVBOR" },
      },
    },
  ];

  const created = await createPayment(pixRequest, intent);

  expect(created).toMatchObject({
    id: "123",
    status: "pending",
    statusDetail: "pending_waiting_transfer",
    amount: 70.5,
    currency: "BRL",
    expiresAt: Date.parse("2026-09-01T12:30:10Z"),
    pix: { qrCode: "000201pix", qrCodeBase64: "iVBOR" },
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("https://api.mercadopago.com/v1/payments");
  expect(calls[0]!.init).toMatchObject({
    method: "POST",
    headers: { "X-Idempotency-Key": "mp-recorded-intent" },
  });
  expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
    transaction_amount: 70.5,
    payment_method_id: "pix",
    external_reference: "ABC123",
    description: "Voucher ABC123",
    payer: { email: "visitante@example.com" },
    date_of_expiration: "2026-09-01T12:30:10.000Z",
  });
});

test("a Pix response without its QR code is not accepted as a created charge", async () => {
  replies = [{ ...payment, status: "pending", currency_id: "BRL" }];

  await expect(createPayment(pixRequest, intent)).rejects.toThrow();
});
