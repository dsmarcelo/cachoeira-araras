import { env } from "@/env";

import type {
  PaymentCreationResponse,
  PaymentProvider,
  PaymentRequest,
  PaymentStatusResponse,
} from "../provider";

interface GetnetTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GetnetPaymentResponse {
  charge_uuid: string;
  redirect_url: string;
  status: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = env.GETNET_CLIENT_ID;
  const clientSecret = env.GETNET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GETNET_CLIENT_ID and GETNET_CLIENT_SECRET are required");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const response = await fetch(`${env.GETNET_BASE_URL}/v1/auth/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to obtain Getnet access token");
  }

  const data = (await response.json()) as GetnetTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.token;
}

export function createGetnetPaymentProvider(): PaymentProvider {
  return {
    async createPayment(request: PaymentRequest): Promise<PaymentCreationResponse> {
      const sellerId = env.GETNET_SELLER_ID ?? env.SELLER_ID;
      if (!sellerId) {
        throw new Error("GETNET_SELLER_ID is required to create payments");
      }

      const token = await getAccessToken();

      const response = await fetch(`${env.GETNET_BASE_URL}/v1/payments/charges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        body: JSON.stringify({
          seller_id: sellerId,
          amount: request.unitPrice * request.quantity,
          currency: "BRL",
          item_description: request.description,
          order_id: request.code,
          payment_method: {
            type: "LINK",
          },
          customer: {
            first_name: request.buyer.name,
            last_name: request.buyer.surname,
            phone_number: request.buyer.phone,
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.text();
        throw new Error(`Getnet create payment failed: ${errorPayload}`);
      }

      const data = (await response.json()) as GetnetPaymentResponse;

      return {
        preferenceId: data.charge_uuid,
        paymentLink: data.redirect_url,
        raw: data,
      };
    },

    async getPaymentStatus(reference: string): Promise<PaymentStatusResponse | null> {
      const sellerId = env.GETNET_SELLER_ID ?? env.SELLER_ID;
      if (!sellerId) {
        return null;
      }

      const token = await getAccessToken();

      const response = await fetch(
        `${env.GETNET_BASE_URL}/v1/payments/charges/${reference}?seller_id=${sellerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { status: string; payment_id?: string };

      return {
        status: data.status,
        paymentId: data.payment_id,
        provider: "getnet",
        raw: data,
      };
    },
  };
}

