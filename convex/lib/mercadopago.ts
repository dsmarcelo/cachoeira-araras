import {
  buildMercadoPagoWebhookUrl,
  normalizePublicBaseUrl,
  resolveWebhookBaseForCheckout,
} from "../../src/server/mercadopago-checkout";

/**
 * Mercado Pago checkout preference creation, isolated in its own module so
 * tests can stub it at the module boundary instead of mocking `fetch`
 * globally. Plain REST calls rather than the `mercadopago` SDK, since Convex
 * actions run in the same V8 isolate runtime as queries and mutations
 * unless they opt into `"use node"`, and `fetch` is all this needs.
 */

const mercadoPagoApiBase = "https://api.mercadopago.com";

export interface CheckoutPreferenceInput {
  code: string;
  description: string;
  priceCents: number;
  name: string;
  surname: string;
  phone: string;
}

export interface CheckoutPreferenceResult {
  id: string;
  initPoint: string;
}

/**
 * Public origin for Mercado Pago `back_urls`, read from the Convex
 * deployment's own env (set via `npx convex env set`), independent of the
 * Next.js app's Vercel env.
 */
function resolveSiteBaseForCheckout(): string {
  const primary = (process.env.URL ?? "").trim();
  if (primary) return normalizePublicBaseUrl(primary);

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercelUrl) return normalizePublicBaseUrl(`https://${vercelUrl}`);

  const productionUrl =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) return normalizePublicBaseUrl(`https://${productionUrl}`);

  return "http://localhost:3000";
}

function formatMercadoPagoPhone(phone: string) {
  return {
    area_code: phone.substring(0, 2),
    number: phone.substring(2),
  };
}

export async function createCheckoutPreference(
  input: CheckoutPreferenceInput,
): Promise<CheckoutPreferenceResult> {
  const token = process.env.MERCADOPAGO_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_TOKEN não está configurado.");
  }

  const siteBase = resolveSiteBaseForCheckout();
  const webhookBase = resolveWebhookBaseForCheckout({
    siteBaseUrl: siteBase,
    webhookUrl: process.env.WEBHOOK_URL,
  });

  const response = await fetch(`${mercadoPagoApiBase}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.code,
    },
    body: JSON.stringify({
      items: [
        {
          id: input.code,
          description: input.description,
          title: `Voucher ${input.code}`,
          quantity: 1,
          // Mercado Pago's unit_price is decimal reais; priceCents is the
          // only place this conversion happens on the way out.
          unit_price: input.priceCents / 100,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: input.name,
        surname: input.surname,
        phone: formatMercadoPagoPhone(input.phone),
      },
      back_urls: {
        success: `${siteBase}/pagamento/`,
        failure: `${siteBase}/pagamento/`,
        pending: `${siteBase}/pagamento/`,
      },
      external_reference: input.code,
      expires: true,
      auto_return: "approved",
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 10,
      ).toISOString(),
      payment_methods: {
        excluded_payment_methods: [{ id: "bolbradesco" }, { id: "pec" }],
      },
      statement_descriptor: "Cachoeira das Araras",
      notification_url: buildMercadoPagoWebhookUrl(webhookBase),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao criar preferência de pagamento (status ${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    id?: string;
    init_point?: string;
  };

  if (!data.id || !data.init_point) {
    throw new Error("Falha ao criar preferência de pagamento.");
  }

  return { id: data.id, initPoint: data.init_point };
}
