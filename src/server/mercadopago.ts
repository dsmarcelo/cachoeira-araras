import "server-only";

import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";

const token = process.env.MERCADOPAGO_TOKEN;

if (!token) {
  throw new Error("MERCADOPAGO_TOKEN is not set");
}

async function fetchMercadoPagoJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
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
  return await fetchMercadoPagoJson<PaymentResponse>(`/v1/payments/${paymentId}`);
}
