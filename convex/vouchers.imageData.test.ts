/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const testSecret = "test-only-shared-secret";
const lookupToken = "11111111-1111-4111-8111-111111111111";
const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET;

beforeEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = testSecret;
});

afterEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET = previousSecret;
});

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as "pending" | "valid" | "redeemed" | "expired",
    visitDate: "2026-09-10",
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    isTest: false,
    lookupToken,
  };
}

async function insertVoucher(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  const voucher = { ...defaults(), ...overrides };
  await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
  return voucher;
}

function imageDataRequest(
  body: Record<string, unknown>,
  secret: string | undefined,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-webhook-secret"] = secret;
  return { method: "POST", headers, body: JSON.stringify(body) };
}

const authorizedBody = { code: "a1b2", lookupToken };

test("getVoucherForImage has no public entry point a signed-in caller can reach", () => {
  // There is deliberately no `api.vouchers.getVoucherForImage` — only
  // `internal.vouchers.getVoucherForImage`, reached exclusively via the
  // /services/voucher-image-data HTTP action below. A browser session can't
  // read name/phone through the client SDK no matter what capability it holds.
  expect("getVoucherForImage" in api.vouchers).toBe(false);
});

test("the image-data door rejects a request with no shared secret", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest(authorizedBody, undefined),
  );

  expect(response.status).toBe(401);
});

test("the image-data door rejects a wrong shared secret", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest(authorizedBody, "not-the-secret"),
  );

  expect(response.status).toBe(401);
});

test("the image-data door requires a lookup capability", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest({ code: "a1b2" }, testSecret),
  );

  expect(response.status).toBe(400);
});

test("the image-data door returns the full record only for a capability bound to the Voucher Code", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t);

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest(authorizedBody, testSecret),
  );

  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    priceCents: 5000,
    status: "valid",
  });

  const wrongCapabilityResponse = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest(
      {
        code: "a1b2",
        lookupToken: "22222222-2222-4222-8222-222222222222",
      },
      testSecret,
    ),
  );
  await expect(wrongCapabilityResponse.json()).resolves.toBeNull();
});

test("an unknown code returns null rather than erroring", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest({ code: "zzzz", lookupToken }, testSecret),
  );

  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(body).toBeNull();
});

test("a soft-deleted voucher's code returns null", async () => {
  const t = convexTest(schema, modules);
  await insertVoucher(t, { code: "gone" });
  await t.run(async (ctx) => {
    const doc = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "gone"))
      .unique();
    await ctx.db.patch(doc!._id, { deletedAt: Date.now() });
  });

  const response = await t.fetch(
    "/services/voucher-image-data",
    imageDataRequest({ code: "gone", lookupToken }, testSecret),
  );

  const body: unknown = await response.json();
  expect(body).toBeNull();
});
