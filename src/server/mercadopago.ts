import "server-only";

import { env } from "@/env";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import {
  capturePaymentFlowException,
  capturePaymentFlowMessage,
  startPaymentFlowSpan,
} from "@/lib/sentry/payment";

const token = env.MERCADOPAGO_TOKEN;
const mercadoPagoApiBase = "https://api.mercadopago.com";

export interface MercadoPagoPaymentSearchResult {
  id: string;
  status: string | null;
  externalReference: string | null;
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

async function fetchMercadoPagoJson<T>(path: string): Promise<T | null> {
  const step = path.startsWith("/v1/payments/")
    ? "fetch_payment"
    : "fetch_preference";

  try {
    return await startPaymentFlowSpan(
      step,
      `Fetch Mercado Pago API ${path.split("?")[0]}`,
      { path: path.split("?")[0] },
      async () => {
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

          capturePaymentFlowMessage(
            "Mercado Pago API returned non-OK status",
            step,
            {
              path: path.split("?")[0],
              status: response.status,
            },
          );
          return null;
        }

        return (await response.json()) as T;
      },
    );
  } catch (error) {
    capturePaymentFlowException(error, step, { path: path.split("?")[0] });
    throw error;
  }
}

export async function getMercadoPagoPreference(
  preferenceId: string,
): Promise<PreferenceResponse | null> {
  return await fetchMercadoPagoJson<PreferenceResponse>(
    `/checkout/preferences/${preferenceId}`,
  );
}

export async function getMercadoPagoPayment(
  paymentId: string,
): Promise<PaymentResponse | null> {
  return await fetchMercadoPagoJson<PaymentResponse>(
    `/v1/payments/${paymentId}`,
  );
}

type MercadoPagoPaymentSearchResponse = {
  paging?: {
    total?: number;
  };
  results?: MercadoPagoRawPayment[];
};

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

export async function searchMercadoPagoPaymentsByExternalReference(
  externalReference: string,
): Promise<MercadoPagoPaymentSearchResult[]> {
  const normalizedReference = externalReference.trim();
  if (!normalizedReference) {
    return [];
  }

  const searchParams = new URLSearchParams({
    external_reference: normalizedReference,
    limit: "10",
    sort: "date_created",
    criteria: "desc",
  });

  const response = await fetchMercadoPagoJson<MercadoPagoPaymentSearchResponse>(
    `/v1/payments/search?${searchParams.toString()}`,
  );

  const results = response?.results ?? [];
  return results
    .map((result) => {
      const id = normalizePaymentId(result.id);
      if (!id) {
        return null;
      }

      return {
        id,
        status: result.status ?? null,
        externalReference: result.external_reference ?? null,
      } satisfies MercadoPagoPaymentSearchResult;
    })
    .filter((item): item is MercadoPagoPaymentSearchResult => item !== null);
}

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
