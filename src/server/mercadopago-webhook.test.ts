import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import test from "node:test";

import {
  parseMercadoPagoSignature,
  verifyMercadoPagoWebhookSignature,
} from "./mercadopago-webhook.ts";

const secret = "test-webhook-secret";
const dataId = "123456";
const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
const ts = "1742505638683";

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
