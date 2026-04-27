import { env } from "@/env";
import { type NextRequest } from "next/server";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import {
  processMercadoPagoPaymentWebhook,
  resolveMercadoPagoWebhookData,
  verifyMercadoPagoWebhookSignature,
} from "@/server/mercadopago-webhook";
import { getMercadoPagoPayment } from "@/server/mercadopago";
import { processVoucherPaymentWebhook } from "@/server/voucher";
// import { sendWhatsappMessage } from "@/app/lib";

function isValidSignature(
  request_id: string | null,
  signature: string,
  dataID: string,
): boolean {
  const webhookSecret = env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("WEBHOOK_SECRET is not set");
  }

  return verifyMercadoPagoWebhookSignature({
    dataId: dataID,
    requestId: request_id,
    secret: webhookSecret,
    signature,
  });
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function badRequest(error: string, context: WebhookRequestLogContext) {
  logBadRequest(error, context);
  return jsonResponse({ success: false, error }, 400);
}

type WebhookRequestLogContext = {
  hasSignature: boolean;
  hasRequestId: boolean;
  hasDataId: boolean;
  type: string | null;
  sourceNews: string | null;
  path: string;
};

async function readWebhookBody(request: NextRequest): Promise<unknown> {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      const params = new URLSearchParams(rawBody);
      const dataId = params.get("data.id") ?? params.get("id");
      const type = params.get("type") ?? params.get("topic");
      if (!dataId && !type) {
        return null;
      }

      return {
        data: dataId ? { id: dataId } : undefined,
        type,
      } as unknown;
    }
  } catch {
    return null;
  }
}

function logBadRequest(error: string, context: WebhookRequestLogContext) {
  console.warn("Mercado Pago webhook rejected", {
    error,
    hasSignature: context.hasSignature,
    hasRequestId: context.hasRequestId,
    hasDataId: context.hasDataId,
    type: context.type,
    sourceNews: context.sourceNews,
    path: context.path,
  });
}

async function sendPaymentConversionEvents(
  payment: unknown,
  payment_id: string,
) {
  if (!payment || typeof payment !== "object") {
    return;
  }

  const paymentPayload = payment as PaymentResponse;

  // Send Facebook Pixel conversion event for approved payments
  try {
    const pixelResult = await sendFacebookPixelEvent(paymentPayload);
    if (pixelResult) {
      console.log(
        `Facebook Pixel event sent successfully for payment ${payment_id}`,
      );
    } else {
      console.log(`Facebook Pixel event skipped for payment ${payment_id}`);
    }
  } catch (error: unknown) {
    console.error("Error sending Facebook Pixel event:", String(error));
    // Don't fail the webhook if Facebook Pixel fails
  }

  // Send Google Ads conversion event for approved payments
  try {
    const googleAdsResult: boolean =
      await sendGoogleAdsConversion(paymentPayload);
    if (googleAdsResult) {
      console.log(
        `Google Ads conversion sent successfully for payment ${payment_id}`,
      );
    } else {
      console.log(`Google Ads conversion skipped for payment ${payment_id}`);
    }
  } catch (error: unknown) {
    console.error("Error sending Google Ads conversion:", String(error));
    // Don't fail the webhook if Google Ads fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-signature");
    const request_id = request.headers.get("x-request-id");
    const searchParams = request.nextUrl.searchParams;
    const body = await readWebhookBody(request);
    const { dataId: dataID, type } = resolveMercadoPagoWebhookData({
      searchParams,
      body,
    });
    const sourceNews = searchParams.get("source_news");
    const requestLogContext: WebhookRequestLogContext = {
      hasSignature: Boolean(signature),
      hasRequestId: Boolean(request_id),
      hasDataId: Boolean(dataID),
      type,
      sourceNews,
      path: request.nextUrl.pathname,
    };

    if (!signature) {
      return badRequest("Missing x-signature header", requestLogContext);
    }

    if (!dataID) {
      return badRequest("Missing data.id", requestLogContext);
    }

    if (!isValidSignature(request_id, signature, dataID)) {
      return badRequest("Invalid signature", requestLogContext);
    }

    const result = await processMercadoPagoPaymentWebhook({
      dataId: dataID,
      type,
      getPayment: getMercadoPagoPayment,
      processVoucherPayment: processVoucherPaymentWebhook,
      sendConversionEvents: sendPaymentConversionEvents,
    });

    return jsonResponse(result.body, result.status);
  } catch (error: unknown) {
    console.error("Error processing webhook:", String(error));
    return jsonResponse(
      { success: false, error: "Internal Server Error" },
      500,
    );
  }
}
