import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildMercadoPagoSignatureManifest,
  parseMercadoPagoSignature,
  processMercadoPagoPaymentWebhook,
  resolveMercadoPagoWebhookData,
  verifyMercadoPagoWebhookSignature,
} from "./mercadopago-webhook.ts";
import {
  buildMercadoPagoWebhookUrl,
  resolveWebhookBaseForCheckout,
} from "./mercadopago-checkout.ts";

const secret = "test-webhook-secret";
const dataId = "123456";
const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
const ts = "1742505638683";
const silentLogger = {
  warn() {
    return undefined;
  },
};

await test("validates a Mercado Pago webhook signature", () => {
  const signature = buildSignature({ dataId, requestId, secret, ts });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId,
      requestId,
      secret,
      signature,
    }),
    true,
  );
});

await test("validates a Mercado Pago webhook signature with source_news in URL", () => {
  const webhookUrl = new URL(
    "https://tough-totally-honeybee.ngrok-free.app/api/webhook?data.id=155823345041&source_news=webhooks&type=payment",
  );
  const webhookDataId = webhookUrl.searchParams.get("data.id");
  assert.equal(webhookDataId, "155823345041");
  const signature = buildSignature({
    dataId: webhookDataId,
    requestId,
    secret,
    ts,
  });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: webhookDataId,
      requestId,
      secret,
      signature,
    }),
    true,
  );
});

await test("validates a Mercado Pago webhook signature without x-request-id", () => {
  const signature = buildSignature({ dataId, secret, ts });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId,
      requestId: null,
      secret,
      signature,
    }),
    true,
  );
});

await test("rejects an invalid Mercado Pago webhook signature", () => {
  const signature = buildSignature({ dataId, requestId, secret, ts });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId,
      requestId: "different-request-id",
      secret,
      signature,
    }),
    false,
  );
});

await test("rejects a signature when data.id is missing", () => {
  const signature = buildSignature({ requestId, secret, ts });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: "",
      requestId,
      secret,
      signature,
    }),
    false,
  );
});

await test("rejects malformed Mercado Pago webhook signatures", () => {
  assert.equal(parseMercadoPagoSignature("ts=1742505638683"), null);
  assert.equal(parseMercadoPagoSignature("v1=abc123"), null);
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId,
      requestId,
      secret,
      signature: "ts=1742505638683,v1=not-hex",
    }),
    false,
  );
});

await test("lowercases alphanumeric data.id values for signature validation", () => {
  const alphanumericDataId = "ABC123";
  const signature = buildSignature({
    dataId: alphanumericDataId.toLowerCase(),
    requestId,
    secret,
    ts,
  });

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: alphanumericDataId,
      requestId,
      secret,
      signature,
    }),
    true,
  );
});

await test("builds manifests from only the available Mercado Pago webhook fields", () => {
  assert.equal(
    buildMercadoPagoSignatureManifest({
      dataId,
      requestId,
      ts,
    }),
    `id:${dataId};request-id:${requestId};ts:${ts};`,
  );

  assert.equal(
    buildMercadoPagoSignatureManifest({
      dataId,
      ts,
    }),
    `id:${dataId};ts:${ts};`,
  );

  assert.equal(
    buildMercadoPagoSignatureManifest({
      dataId: "ABC123",
      ts,
    }),
    `id:abc123;ts:${ts};`,
  );
});

await test("resolves webhook data from query params before body", () => {
  const result = resolveMercadoPagoWebhookData({
    searchParams: new URLSearchParams("data.id=query-id&type=payment"),
    body: {
      data: { id: "body-id" },
      type: "merchant_order",
    },
  });

  assert.deepEqual(result, {
    dataId: "query-id",
    type: "payment",
  });
});

await test("resolves webhook data from body when query params are missing", () => {
  const result = resolveMercadoPagoWebhookData({
    searchParams: new URLSearchParams(),
    body: {
      data: { id: "155823345041" },
      type: "payment",
    },
  });

  assert.deepEqual(result, {
    dataId: "155823345041",
    type: "payment",
  });
});

await test("returns null webhook data when query and body are missing data.id", () => {
  const result = resolveMercadoPagoWebhookData({
    searchParams: new URLSearchParams("source_news=webhooks&type=payment"),
    body: {
      data: {},
    },
  });

  assert.deepEqual(result, {
    dataId: null,
    type: "payment",
  });
});

await test("ignores signed non-payment webhook events with HTTP 200", async () => {
  let getPaymentCalls = 0;
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "merchant_order",
    getPayment: async () => {
      getPaymentCalls += 1;
      return null;
    },
    processVoucherPayment: async () => ({
      outcome: "updated",
      shouldSendConversionEvents: false,
    }),
    logger: silentLogger,
  });

  assert.equal(getPaymentCalls, 0);
  assert.deepEqual(result, {
    status: 200,
    body: {
      success: true,
      outcome: "ignored",
    },
  });
});

await test("returns HTTP 200 when Mercado Pago payment is not found", async () => {
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "payment",
    getPayment: async () => null,
    processVoucherPayment: async () => ({
      outcome: "updated",
      shouldSendConversionEvents: false,
    }),
    logger: silentLogger,
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      success: false,
      outcome: "payment_not_found",
    },
  });
});

await test("treats payment type case-insensitively", async () => {
  let getPaymentCalls = 0;
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "Payment",
    getPayment: async () => {
      getPaymentCalls += 1;
      return null;
    },
    processVoucherPayment: async () => ({
      outcome: "updated",
      shouldSendConversionEvents: false,
    }),
    logger: silentLogger,
  });

  assert.equal(getPaymentCalls, 1);
  assert.deepEqual(result, {
    status: 200,
    body: {
      success: false,
      outcome: "payment_not_found",
    },
  });
});

await test("returns HTTP 200 when payment has no voucher reference", async () => {
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "payment",
    getPayment: async () => ({
      external_reference: null,
      status: "approved",
    }),
    processVoucherPayment: async () => ({
      outcome: "updated",
      shouldSendConversionEvents: false,
    }),
    logger: silentLogger,
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      success: false,
      outcome: "voucher_not_found",
    },
  });
});

await test("returns HTTP 200 when voucher is not found", async () => {
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "payment",
    getPayment: async () => ({
      external_reference: "abcd",
      status: "approved",
    }),
    processVoucherPayment: async () => ({
      outcome: "not_found",
      shouldSendConversionEvents: false,
    }),
    logger: silentLogger,
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      success: false,
      outcome: "voucher_not_found",
    },
  });
});

await test("sends conversion events only for newly processed vouchers", async () => {
  let conversionCalls = 0;
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "payment",
    getPayment: async () => ({
      external_reference: "abcd",
      status: "approved",
    }),
    processVoucherPayment: async () => ({
      outcome: "updated",
      shouldSendConversionEvents: true,
    }),
    sendConversionEvents: async () => {
      conversionCalls += 1;
    },
    logger: silentLogger,
  });

  assert.equal(conversionCalls, 1);
  assert.deepEqual(result, {
    status: 200,
    body: {
      success: true,
      outcome: "updated",
    },
  });
});

await test("does not send conversion events for already processed vouchers", async () => {
  let conversionCalls = 0;
  const result = await processMercadoPagoPaymentWebhook({
    dataId,
    type: "payment",
    getPayment: async () => ({
      external_reference: "abcd",
      status: "approved",
    }),
    processVoucherPayment: async () => ({
      outcome: "already_processed",
      shouldSendConversionEvents: false,
    }),
    sendConversionEvents: async () => {
      conversionCalls += 1;
    },
    logger: silentLogger,
  });

  assert.equal(conversionCalls, 0);
  assert.deepEqual(result, {
    status: 200,
    body: {
      success: true,
      outcome: "already_processed",
    },
  });
});

await test("plural webhook route reexports the singular handler", async () => {
  const routeFile = await readFile(
    new URL("../app/api/webhooks/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(routeFile, /export \{ POST \} from "\.\.\/webhook\/route";/);
});

await test("explicit webhook URL takes priority over site URL", () => {
  assert.equal(
    resolveWebhookBaseForCheckout({
      siteBaseUrl: "https://site.example.com",
      webhookUrl: "https://webhook.example.com/",
    }),
    "https://webhook.example.com",
  );
});

await test("site URL is used as webhook fallback", () => {
  assert.equal(
    resolveWebhookBaseForCheckout({
      siteBaseUrl: "https://tough-totally-honeybee.ngrok-free.app/",
    }),
    "https://tough-totally-honeybee.ngrok-free.app",
  );
});

await test("Mercado Pago webhook URL forces signed Webhooks", () => {
  assert.equal(
    buildMercadoPagoWebhookUrl("https://tough-totally-honeybee.ngrok-free.app/"),
    "https://tough-totally-honeybee.ngrok-free.app/api/webhook?source_news=webhooks",
  );
});

function buildSignature({
  dataId,
  requestId,
  secret,
  ts,
}: {
  dataId?: string | null;
  requestId?: string | null;
  secret: string;
  ts: string;
}) {
  const manifest = buildMercadoPagoSignatureManifest({
    dataId,
    requestId,
    ts,
  });
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return `ts=${ts},v1=${hash}`;
}
