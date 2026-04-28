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
  results?: Array<{
    id?: number | string;
    status?: string | null;
    external_reference?: string | null;
  }>;
};

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
      const id =
        typeof result.id === "number"
          ? String(result.id)
          : typeof result.id === "string"
            ? result.id
            : null;
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
