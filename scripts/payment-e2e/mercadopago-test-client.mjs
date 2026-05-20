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
