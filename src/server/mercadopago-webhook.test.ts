import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseMercadoPagoSignature,
  processMercadoPagoPaymentWebhook,
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
  dataId: string;
  requestId: string;
  secret: string;
  ts: string;
}) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return `ts=${ts},v1=${hash}`;
}
