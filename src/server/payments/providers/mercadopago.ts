import { Preference, MercadoPagoConfig } from "mercadopago";

import type { PaymentProvider, PaymentRequest } from "../provider";

const token = process.env.MERCADOPAGO_TOKEN;

if (!token) {
  throw new Error("MERCADOPAGO_TOKEN is not set");
}

const baseUrl = (() => {
  if (process.env.URL) return process.env.URL;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
})();

const webhookUrl = process.env.WEBHOOK_URL;

const client = new MercadoPagoConfig({
  accessToken: token,
  options: { timeout: 8000 },
});

function formatPhone(phone: string) {
  return {
    area_code: phone.substring(0, 2),
    number: phone.substring(2),
  };
}

export function createMercadoPagoPaymentProvider(): PaymentProvider {
  return {
    async createPayment(request: PaymentRequest) {
      const preference = new Preference(client);

      const response = await preference.create({
        body: {
          items: [
            {
              id: request.code,
              description: request.description,
              title: request.title,
              quantity: request.quantity,
              unit_price: request.unitPrice,
              currency_id: "BRL",
            },
          ],
          payer: {
            name: request.buyer.name,
            surname: request.buyer.surname,
            phone: formatPhone(request.buyer.phone),
          },
          external_reference: request.code,
          back_urls: {
            success: `${baseUrl}/pagamento/`,
            failure: `${baseUrl}/pagamento/`,
            pending: `${baseUrl}/pagamento/`,
          },
          notification_url: webhookUrl
            ? `${webhookUrl}/api/webhook`
            : undefined,
          expires: true,
          auto_return: "approved",
        },
      });

      return {
        preferenceId: response.id ?? "",
        paymentLink: response.init_point ?? "",
        raw: response,
      };
    },

    async getPaymentStatus(reference: string) {
      const res = await fetch(
        `https://api.mercadopago.com/checkout/preferences/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        payments?: Array<{ id: string; status: string }>;
      };

      const payment = data.payments?.at(0);

      return {
        status: payment?.status ?? "pending",
        paymentId: payment?.id?.toString(),
        provider: "mercadopago" as const,
        raw: data,
      };
    },
  };
}

