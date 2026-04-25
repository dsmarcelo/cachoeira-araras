import { createHmac, randomUUID } from "node:crypto";

const mercadoPagoApiUrl = "https://api.mercadopago.com";

async function fetchMercadoPago(path, options) {
  const response = await fetch(`${mercadoPagoApiUrl}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Mercado Pago API failed ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

export async function createPreference({
  accessToken,
  baseUrl,
  webhookUrl,
  code,
  name,
  phone,
  price,
  description,
}) {
  return await fetchMercadoPago("/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `preference-${code}-${Date.now()}`,
    },
    body: JSON.stringify({
      items: [
        {
          id: code,
          title: `Voucher ${code}`,
          description,
          quantity: 1,
          unit_price: price,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: name.trim().split(" ")[0] ?? "",
        surname: name.trim().split(" ").slice(1).join(" ") ?? "",
        phone: {
          area_code: phone.substring(0, 2),
          number: phone.substring(2),
        },
      },
      back_urls: {
        success: `${baseUrl}/pagamento/`,
        failure: `${baseUrl}/pagamento/`,
        pending: `${baseUrl}/pagamento/`,
      },
      external_reference: code,
      notification_url: `${webhookUrl}/api/webhook`,
      expires: true,
      auto_return: "approved",
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      payment_methods: {
        excluded_payment_methods: [{ id: "bolbradesco" }, { id: "pec" }],
      },
      statement_descriptor: "Cachoeira das Araras",
    }),
  });
}

export async function createCardToken({
  publicKey,
  cardNumber,
  securityCode,
  expirationMonth,
  expirationYear,
  cardholderName,
  identificationNumber,
  identificationType = "CPF",
}) {
  return await fetchMercadoPago(
    `/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card_number: cardNumber.replace(/\D/g, ""),
        security_code: securityCode,
        expiration_month: Number(expirationMonth),
        expiration_year: Number(expirationYear),
        cardholder: {
          name: cardholderName,
          identification: {
            type: identificationType,
            number: identificationNumber,
          },
        },
      }),
    },
  );
}

export async function createDirectCardPayment({
  accessToken,
  code,
  cardToken,
  payerEmail,
  payerIdentificationNumber,
  payerIdentificationType = "CPF",
  paymentMethodId = "visa",
  issuerId,
  price,
  description,
  notificationUrl,
}) {
  const body = {
    transaction_amount: price,
    token: cardToken,
    description,
    installments: 1,
    payment_method_id: paymentMethodId,
    external_reference: code,
    notification_url: notificationUrl,
    payer: {
      email: payerEmail,
      identification: payerIdentificationNumber
        ? {
            type: payerIdentificationType,
            number: payerIdentificationNumber,
          }
        : undefined,
    },
  };

  if (issuerId) {
    body.issuer_id = issuerId;
  }

  return await fetchMercadoPago("/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `payment-${code}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
}

export async function getPayment({ accessToken, paymentId }) {
  return await fetchMercadoPago(`/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function postSignedWebhook({ baseUrl, webhookSecret, paymentId }) {
  const requestId = randomUUID();
  const timestamp = String(Date.now());
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const signature = createHmac("sha256", webhookSecret)
    .update(manifest)
    .digest("hex");

  const response = await fetch(`${baseUrl}/api/webhook?data.id=${paymentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-signature": `ts=${timestamp},v1=${signature}`,
    },
    body: JSON.stringify({
      action: "payment.updated",
      api_version: "v1",
      data: { id: paymentId },
      type: "payment",
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Webhook failed ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}
