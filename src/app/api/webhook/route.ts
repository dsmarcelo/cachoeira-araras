import { env } from "@/env";
import { type NextRequest } from "next/server";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import {
  processMercadoPagoPaymentWebhook,
  verifyMercadoPagoWebhookSignature,
} from "@/server/mercadopago-webhook";
import { getMercadoPagoPayment } from "@/server/mercadopago";
import { processVoucherPaymentWebhook } from "@/server/voucher";
// import { sendWhatsappMessage } from "@/app/lib";

function isValidSignature(
  request_id: string,
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

function badRequest(error: string) {
  return jsonResponse({ success: false, error }, 400);
}

async function sendPaymentConversionEvents(payment: unknown, payment_id: string) {
  if (!payment || typeof payment !== "object") {
    return;
  }

  const paymentPayload = payment as PaymentResponse;

  // Send Facebook Pixel conversion event for approved payments
  try {
    const pixelResult = await sendFacebookPixelEvent(paymentPayload);
    if (pixelResult) {
      console.log(`Facebook Pixel event sent successfully for payment ${payment_id}`);
    } else {
      console.log(`Facebook Pixel event skipped for payment ${payment_id}`);
    }
  } catch (error: unknown) {
    console.error("Error sending Facebook Pixel event:", String(error));
    // Don't fail the webhook if Facebook Pixel fails
  }

  // Send Google Ads conversion event for approved payments
  try {
    const googleAdsResult: boolean = await sendGoogleAdsConversion(paymentPayload);
    if (googleAdsResult) {
      console.log(`Google Ads conversion sent successfully for payment ${payment_id}`);
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
    const dataID = searchParams.get("data.id");
    const type = searchParams.get("type");

    if (!signature) {
      return badRequest("Missing x-signature header");
    }

    if (!request_id) {
      return badRequest("Missing x-request-id header");
    }

    if (!dataID) {
      return badRequest("Missing data.id query param");
    }

    if (!isValidSignature(request_id, signature, dataID)) {
      return badRequest("Invalid signature");
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
    return jsonResponse({ success: false, error: "Internal Server Error" }, 500);
  }
}
