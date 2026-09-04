import {
  buildMercadoPagoWebhookUrl,
  normalizePublicBaseUrl,
  resolveWebhookBaseForCheckout,
} from "../../src/server/mercadopago-checkout";

/**
 * Mercado Pago checkout preference creation and payment search, isolated in
 * its own module so tests can stub it at the module boundary instead of
 * mocking `fetch` globally. Plain REST calls rather than the `mercadopago`
 * SDK, since Convex actions run in the same V8 isolate runtime as queries and
 * mutations unless they opt into `"use node"`, and `fetch` is all this needs.
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

export interface MercadoPagoPaymentListItem {
  id: string;
  status: string | null;
  statusDetail: string | null;
  externalReference: string | null;
  dateCreated: string | null;
  dateApproved: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  payerEmail: string | null;
  payerName: string | null;
  refundedAmount: number | null;
}

export interface MercadoPagoPaymentListResult {
  items: MercadoPagoPaymentListItem[];
  total: number;
}

export interface SearchMercadoPagoPaymentsInput {
  beginDate: Date;
  endDate: Date;
  limit: number;
  offset: number;
  status?: string;
  externalReference?: string;
}

export type MercadoPagoRawPayment = {
  id?: number | string;
  status?: string | null;
  status_detail?: string | null;
  external_reference?: string | null;
  date_created?: string | null;
  date_approved?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  payer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  transaction_details?: {
    total_paid_amount?: number | null;
  } | null;
  refunded_amount?: number | null;
};

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

function normalizePaymentId(id: number | string | undefined): string | null {
  if (typeof id === "number") return String(id);
  if (typeof id === "string" && id.trim()) return id;
  return null;
}

function formatPayerName(payment: MercadoPagoRawPayment): string | null {
  const parts = [payment.payer?.first_name, payment.payer?.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : null;
}

export function mapMercadoPagoPayment(
  payment: MercadoPagoRawPayment,
): MercadoPagoPaymentListItem | null {
  const id = normalizePaymentId(payment.id);
  if (!id) return null;

  return {
    id,
    status: payment.status ?? null,
    statusDetail: payment.status_detail ?? null,
    externalReference: payment.external_reference ?? null,
    dateCreated: payment.date_created ?? null,
    dateApproved: payment.date_approved ?? null,
    transactionAmount:
      payment.transaction_amount ??
      payment.transaction_details?.total_paid_amount ??
      null,
    currencyId: payment.currency_id ?? null,
    paymentMethodId: payment.payment_method_id ?? null,
    paymentTypeId: payment.payment_type_id ?? null,
    payerEmail: payment.payer?.email ?? null,
    payerName: formatPayerName(payment),
    refundedAmount: payment.refunded_amount ?? null,
  };
}

async function fetchMercadoPagoJson<T>(path: string): Promise<T | null> {
  const token = process.env.MERCADOPAGO_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_TOKEN não está configurado.");
  }

  const response = await fetch(`${mercadoPagoApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status >= 500) {
      throw new Error(`Mercado Pago API failed with ${response.status}`);
    }
    return null;
  }

  return (await response.json()) as T;
}

export async function getMercadoPagoPayment(
  paymentId: string,
): Promise<MercadoPagoRawPayment | null> {
  return await fetchMercadoPagoJson<MercadoPagoRawPayment>(
    `/v1/payments/${paymentId}`,
  );
}

type MercadoPagoPaymentSearchResponse = {
  paging?: {
    total?: number;
  };
  results?: MercadoPagoRawPayment[];
};

export async function searchMercadoPagoPayments({
  beginDate,
  endDate,
  limit,
  offset,
  status,
  externalReference,
}: SearchMercadoPagoPaymentsInput): Promise<MercadoPagoPaymentListResult> {
  const searchParams = new URLSearchParams({
    range: "date_created",
    begin_date: beginDate.toISOString(),
    end_date: endDate.toISOString(),
    limit: String(limit),
    offset: String(offset),
    sort: "date_created",
    criteria: "desc",
  });

  if (status && status !== "all") {
    searchParams.set("status", status);
  }

  if (externalReference?.trim()) {
    searchParams.set("external_reference", externalReference.trim());
  }

  const response = await fetchMercadoPagoJson<MercadoPagoPaymentSearchResponse>(
    `/v1/payments/search?${searchParams.toString()}`,
  );

  return {
    items: (response?.results ?? [])
      .map(mapMercadoPagoPayment)
      .filter((item): item is MercadoPagoPaymentListItem => item !== null),
    total: response?.paging?.total ?? 0,
  };
}
