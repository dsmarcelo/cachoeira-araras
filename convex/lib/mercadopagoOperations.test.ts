import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cancelPayment,
  chargebackOutcome,
  findChargebacksByPayment,
  findPaymentsByExternalReference,
  searchPaymentsUpdatedBetween,
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

test("payment snapshot carries status detail and refunded amount in integer cents", async () => {
  replies = [
    {
      paging: { total: 1 },
      results: [
        {
          ...payment,
          status: "approved",
          status_detail: "partially_refunded",
          transaction_amount_refunded: 10.1,
        },
      ],
    },
  ];
  const [found] = await searchPaymentsUpdatedBetween(0, 1000);
  expect(found).toMatchObject({
    statusDetail: "partially_refunded",
    refundedCents: 1010,
  });
});

test("updated-since search filters by date_last_updated and pages", async () => {
  replies = [
    {
      paging: { total: 51 },
      results: Array.from({ length: 50 }, (_, id) => ({
        ...payment,
        id: id + 1,
      })),
    },
    { paging: { total: 51 }, results: [{ ...payment, id: 51 }] },
  ];
  expect(await searchPaymentsUpdatedBetween(0, 86_400_000)).toHaveLength(51);
  const urls = calls.map((c) => new URL(c.url));
  expect(urls.map((u) => u.searchParams.get("offset"))).toEqual(["0", "50"]);
  expect(urls[0]!.searchParams.get("range")).toBe("date_last_updated");
  expect(urls[0]!.searchParams.get("begin_date")).toBe(
    "1970-01-01T00:00:00.000Z",
  );
  expect(urls[0]!.searchParams.get("end_date")).toBe(
    "1970-01-02T00:00:00.000Z",
  );
});

test("updated-since search fails on incomplete results and HTTP errors", async () => {
  replies = [{ paging: { total: 80 }, results: [{ ...payment, id: 1 }] }];
  await expect(searchPaymentsUpdatedBetween(0, 1000)).rejects.toThrow(
    "Incomplete payment search",
  );
  replies = [new Response(null, { status: 500 })];
  await expect(searchPaymentsUpdatedBetween(0, 1000)).rejects.toThrow(
    "Mercado Pago API failed with 500",
  );
});

test("chargeback lookup sends the seller id derived from the token", async () => {
  replies = [
    { id: 777 },
    {
      paging: { total: 1 },
      results: [
        {
          id: "234000062890459000",
          payments: [123],
          coverage_applied: false,
          date_created: "2026-09-01T10:00:00.000-03:00",
          date_last_updated: "2026-09-05T10:00:00.000-03:00",
        },
      ],
    },
  ];
  expect(await findChargebacksByPayment("123")).toEqual([
    {
      id: "234000062890459000",
      coverageApplied: false,
      dateCreated: "2026-09-01T10:00:00.000-03:00",
      dateLastUpdated: "2026-09-05T10:00:00.000-03:00",
    },
  ]);
  expect(calls[0]!.url).toBe("https://api.mercadopago.com/users/me");
  expect(calls[1]!.url).toBe(
    "https://api.mercadopago.com/v1/chargebacks/search?payment_id=123&limit=50&offset=0",
  );
  expect(calls[1]!.init.headers).toMatchObject({ "X-Caller-Id": "777" });
});

test("chargeback lookup fails closed on errors and malformed pages", async () => {
  replies = [{ id: 777 }, new Response(null, { status: 403 })];
  await expect(findChargebacksByPayment("123")).rejects.toThrow(
    "Mercado Pago API failed with 403",
  );
  replies = [{ id: 777 }, { results: [] }];
  await expect(findChargebacksByPayment("123")).rejects.toThrow();
  replies = [{ id: 777 }, { paging: { total: 2 }, results: [] }];
  await expect(findChargebacksByPayment("123")).rejects.toThrow(
    "Incomplete chargeback search",
  );
});

const chargebackCase = (
  coverageApplied: boolean | null,
  dateLastUpdated: string | null,
  dateCreated: string | null = null,
) => ({ id: "c", coverageApplied, dateCreated, dateLastUpdated });

test("chargeback outcome maps coverage_applied and the latest case decides", () => {
  expect(chargebackOutcome([])).toBeUndefined();
  expect(
    chargebackOutcome([chargebackCase(true, "2026-09-01T00:00:00Z")]),
  ).toBe("won");
  expect(
    chargebackOutcome([chargebackCase(false, "2026-09-01T00:00:00Z")]),
  ).toBe("lost");
  expect(
    chargebackOutcome([chargebackCase(null, "2026-09-01T00:00:00Z")]),
  ).toBe("open");
  expect(
    chargebackOutcome([
      chargebackCase(false, "2026-09-01T00:00:00Z"),
      chargebackCase(true, "2026-09-05T00:00:00Z"),
    ]),
  ).toBe("won");
  // Falls back to date_created when there is no update date.
  expect(
    chargebackOutcome([
      chargebackCase(true, null, "2026-09-02T00:00:00Z"),
      chargebackCase(false, null, "2026-09-03T00:00:00Z"),
    ]),
  ).toBe("lost");
});
