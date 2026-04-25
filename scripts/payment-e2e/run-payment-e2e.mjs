import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createCardToken,
  createDirectCardPayment,
  createPreference,
  getPayment,
  postSignedWebhook,
} from "./mercadopago-test-client.mjs";
import { loadDotEnv, optionalUrl, requireEnv } from "./env.mjs";
import { VoucherTestDao } from "./voucher-test-dao.mjs";

loadDotEnv();

const accessToken =
  process.env.PAYMENT_E2E_MERCADOPAGO_TOKEN ?? requireEnv("MERCADOPAGO_TOKEN");
const baseUrl = optionalUrl("PAYMENT_E2E_BASE_URL", process.env.URL);
const webhookUrl = optionalUrl("PAYMENT_E2E_WEBHOOK_URL", process.env.WEBHOOK_URL);
const webhookSecret =
  process.env.PAYMENT_E2E_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET;
const requireRealPayment = process.env.PAYMENT_E2E_REQUIRE_REAL_PAYMENT === "true";
const keepData = process.env.PAYMENT_E2E_KEEP_DATA === "true";

if (!baseUrl) {
  throw new Error("Set PAYMENT_E2E_BASE_URL or URL before running payment E2E.");
}

if (!webhookUrl) {
  throw new Error("Set PAYMENT_E2E_WEBHOOK_URL or WEBHOOK_URL before running payment E2E.");
}

const testData = {
  code: process.env.PAYMENT_E2E_CODE ?? generateCode(),
  name: process.env.PAYMENT_E2E_NAME ?? "Cliente Teste Mercado Pago",
  phone: process.env.PAYMENT_E2E_PHONE ?? "11999999999",
  adults: Number(process.env.PAYMENT_E2E_ADULTS ?? 1),
  elderly: Number(process.env.PAYMENT_E2E_ELDERLY ?? 1),
  adultsPool: Number(process.env.PAYMENT_E2E_ADULTS_POOL ?? 1),
  elderlyPool: Number(process.env.PAYMENT_E2E_ELDERLY_POOL ?? 0),
  price: Number(process.env.PAYMENT_E2E_PRICE ?? 0.01),
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

  const paymentId = await resolvePaymentId({
    accessToken,
    code: testData.code,
    price: testData.price,
    description: formatDescription(testData),
    notificationUrl: `${webhookUrl}/api/webhook`,
  });

  if (paymentId && webhookSecret) {
    await postSignedWebhook({
      baseUrl,
      webhookSecret,
      paymentId,
    });

    const webhookVoucher = await dao.findVoucherByCode(testData.code);
    assert.equal(webhookVoucher.status, "valid");
    assert.equal(webhookVoucher.valid, true);
    assert.equal(webhookVoucher.payment_id, String(paymentId));
    console.log(`Signed webhook confirmed voucher with payment ${paymentId}.`);
  } else {
    if (requireRealPayment) {
      throw new Error(
        "Real payment was required, but PAYMENT_E2E_CARD_TOKEN or WEBHOOK_SECRET is missing.",
      );
    }

    const confirmationPaymentId = paymentId ?? `e2e_return_${Date.now()}`;
    await dao.confirmVoucherPaymentByPreferenceId(
      preference.id,
      confirmationPaymentId,
    );

    const confirmedVoucher = await dao.findVoucherByCode(testData.code);
    assert.equal(confirmedVoucher.status, "valid");
    assert.equal(confirmedVoucher.valid, true);
    assert.equal(confirmedVoucher.payment_id, confirmationPaymentId);
    console.log(
      paymentId
        ? "Return-page confirmation path verified with the real payment id."
        : "Return-page confirmation path verified with a simulated payment id.",
    );
  }

  const redeemedVoucher = await dao.redeemVoucherByCode(testData.code);
  assert.equal(redeemedVoucher.status, "redeemed");
  assert.equal(redeemedVoucher.valid, false);
  console.log("Staff/admin redeem behavior verified.");

  await assert.rejects(
    () => dao.redeemVoucherByCode(testData.code),
    /nao esta disponivel/,
  );
  console.log("Voucher reuse is blocked after redemption.");

  assertDeliveryMode();

  console.log("Payment E2E test completed successfully.");
} finally {
  if (!keepData) {
    for (const code of createdCodes) {
      await dao.deleteVoucherByCode(code);
    }
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

async function resolvePaymentId({
  accessToken,
  code,
  price,
  description,
  notificationUrl,
}) {
  const existingPaymentId = process.env.PAYMENT_E2E_PAYMENT_ID;

  if (existingPaymentId) {
    const payment = await getPayment({ accessToken, paymentId: existingPaymentId });
    assert.equal(payment.status, "approved");
    assert.equal(payment.external_reference, code);
    return String(existingPaymentId);
  }

  const cardToken = process.env.PAYMENT_E2E_CARD_TOKEN;
  const generatedCardToken = cardToken ?? (await createCardTokenFromEnv());
  const payerEmail =
    process.env.PAYMENT_E2E_PAYER_EMAIL ??
    process.env.PAYMENT_E2E_BUYER_EMAIL;

  if (!generatedCardToken || !payerEmail) {
    console.log(
      "Skipping real Mercado Pago payment: set card token/card data and buyer email to enable it.",
    );
    return null;
  }

  let payment;

  try {
    payment = await createDirectCardPayment({
      accessToken,
      code,
      cardToken: generatedCardToken,
      payerEmail,
      payerIdentificationNumber: process.env.PAYMENT_E2E_MERCADOPAGO_BUYER_CPF,
      paymentMethodId:
        process.env.PAYMENT_E2E_PAYMENT_METHOD_ID ?? inferPaymentMethodId(),
      issuerId: process.env.PAYMENT_E2E_ISSUER_ID,
      price,
      description,
      notificationUrl,
    });
  } catch (error) {
    if (requireRealPayment) {
      throw error;
    }

    console.log(
      [
        "Mercado Pago real payment could not be created.",
        "Continuing with the app return-confirmation path because PAYMENT_E2E_REQUIRE_REAL_PAYMENT is not true.",
        `Reason: ${error instanceof Error ? error.message : String(error)}`,
      ].join(" "),
    );

    return null;
  }

  assert.equal(payment.external_reference, code);

  if (payment.status !== "approved") {
    const message = `Mercado Pago payment ${payment.id} returned status ${payment.status}.`;

    if (requireRealPayment) {
      throw new Error(message);
    }

    console.log(`${message} Skipping signed webhook assertion.`);
    return null;
  }

  return String(payment.id);
}

function inferPaymentMethodId() {
  const cardNumber = process.env.PAYMENT_E2E_CARD_NUMBER?.replace(/\D/g, "");

  if (cardNumber?.startsWith("4")) {
    return "visa";
  }

  if (
    cardNumber?.startsWith("5") ||
    cardNumber?.startsWith("2")
  ) {
    return "master";
  }

  return "visa";
}

async function createCardTokenFromEnv() {
  const publicKey = process.env.PAYMENT_E2E_MERCADOPAGO_PUBLIC_KEY;
  const cardNumber = process.env.PAYMENT_E2E_CARD_NUMBER;
  const securityCode = process.env.PAYMENT_E2E_CARD_CVV;
  const expirationMonth = process.env.PAYMENT_E2E_CARD_EXPIRATION_MONTH;
  const expirationYear = process.env.PAYMENT_E2E_CARD_EXPIRATION_YEAR;
  const cardholderName =
    process.env.PAYMENT_E2E_MERCADOPAGO_BUYER_NAME ?? "APRO";
  const identificationNumber = process.env.PAYMENT_E2E_MERCADOPAGO_BUYER_CPF;

  if (
    !publicKey ||
    !cardNumber ||
    !securityCode ||
    !expirationMonth ||
    !expirationYear ||
    !identificationNumber
  ) {
    return null;
  }

  const token = await createCardToken({
    publicKey,
    cardNumber,
    securityCode,
    expirationMonth,
    expirationYear,
    cardholderName,
    identificationNumber,
  });

  assert.ok(token.id, "Mercado Pago card token id was not returned.");
  console.log("Generated Mercado Pago card token from test card variables.");

  return token.id;
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

function assertDeliveryMode() {
  const webhookSource = readFileSync("src/app/api/webhook/route.ts", "utf8");
  const hasAutomaticWhatsappSend = /^\s*await\s+sendWhatsappMessage\(/m.test(
    webhookSource,
  );

  assert.equal(
    hasAutomaticWhatsappSend,
    false,
    "Webhook unexpectedly sends WhatsApp automatically. Update this test if delivery behavior changed.",
  );

  console.log("Delivery check verified: WhatsApp is not automatic in the webhook flow.");
}
