import assert from "node:assert/strict";

import { createPreference } from "./mercadopago-test-client.mjs";
import { loadDotEnv, optionalUrl, requireEnv } from "./env.mjs";
import { VoucherTestDao } from "./voucher-test-dao.mjs";

loadDotEnv();

const accessToken = requireEnv("MERCADOPAGO_TOKEN");
const baseUrl = optionalUrl("URL");
const webhookUrl = optionalUrl("WEBHOOK_URL");

if (!baseUrl) {
  throw new Error("Set URL before running payment E2E.");
}

if (!webhookUrl) {
  throw new Error("Set WEBHOOK_URL before running payment E2E.");
}

const testData = {
  code: generateCode(),
  name: "Cliente Teste Mercado Pago",
  phone: "11999999999",
  adults: 1,
  elderly: 1,
  adultsPool: 1,
  elderlyPool: 0,
  price: 0.01,
  expiresAt: tomorrowAtNoon(),
};

const dao = new VoucherTestDao();
const createdCodes = new Set([testData.code]);

try {
  console.log("Starting Mercado Pago payment E2E test...");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Webhook URL: ${webhookUrl}/api/webhook`);
  console.log(`Voucher code: ${testData.code}`);

  await dao.deleteVoucherByCode(testData.code);

  assert.match(testData.code, /^[a-z0-9]{4}$/);
  assert.equal(testData.phone.length, 11);
  assert.equal(testData.phone.charAt(2), "9");
  assert.ok(totalQuantity(testData) > 0, "At least one voucher quantity is required.");

  const preference = await createPreference({
    accessToken,
    baseUrl,
    webhookUrl,
    code: testData.code,
    name: testData.name,
    phone: testData.phone,
    price: testData.price,
    description: formatDescription(testData),
  });

  assert.ok(preference.id, "Mercado Pago preference id was not returned.");
  assert.ok(preference.init_point, "Mercado Pago preference init_point was not returned.");
  console.log(`Preference created: ${preference.id}`);

  await dao.createPendingVoucher({
    ...testData,
    preferenceId: preference.id,
  });

  const pendingVoucher = await dao.findVoucherByCode(testData.code);
  assertVoucherMatchesInput(pendingVoucher, testData, preference.id);
  console.log("Pending voucher persisted and matches buyer input.");
  console.log("Payment E2E test completed successfully.");
} finally {
  for (const code of createdCodes) {
    await dao.deleteVoucherByCode(code);
  }

  await dao.disconnect();
}

function generateCode() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 6);
}

function tomorrowAtNoon() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function totalQuantity(data) {
  return data.adults + data.elderly + data.adultsPool + data.elderlyPool;
}

function formatDescription(data) {
  return [
    `Telefone: ${data.phone}`,
    `Inteira: ${data.adults}`,
    `Meia: ${data.elderly}`,
    `Piscina: ${data.adultsPool}`,
    `Meia piscina: ${data.elderlyPool}`,
    `Codigo: ${data.code}`,
  ].join(" | ");
}

function assertVoucherMatchesInput(voucher, data, preferenceId) {
  assert.ok(voucher, "Voucher was not found in database.");
  assert.equal(voucher.code, data.code);
  assert.equal(voucher.name, data.name);
  assert.equal(voucher.phone, data.phone);
  assert.equal(voucher.adults, data.adults);
  assert.equal(voucher.elderly, data.elderly);
  assert.equal(voucher.adults_pool, data.adultsPool);
  assert.equal(voucher.elderly_pool, data.elderlyPool);
  assert.equal(voucher.price, data.price);
  assert.equal(voucher.valid, false);
  assert.equal(voucher.status, "pending");
  assert.equal(voucher.preference_id, preferenceId);
  assert.equal(voucher.payment_id, null);
}
