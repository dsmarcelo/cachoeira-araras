import { env } from "@/env";
import { type NextRequest } from "next/server";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";
import { verifyMercadoPagoWebhookSignature } from "@/server/mercadopago-webhook";
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

async function validateVoucherPayment(payment_id: string) {
  const payment = await getMercadoPagoPayment(payment_id);
  if (!payment) {
    return new Response(
      JSON.stringify({ success: false, error: "Payment not found" }),
      {
        status: 404,
      },
    );
  }

  const code = payment.external_reference;
  if (!code || typeof code !== "string") {
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );
  }

  const result = await processVoucherPaymentWebhook({
    code,
    paymentId: payment_id,
    paymentStatus: payment.status,
  });

  if (result.outcome === "not_found") {
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );
  }

  if (result.shouldSendConversionEvents) {
    // Send Facebook Pixel conversion event for approved payments
    try {
      const pixelResult = await sendFacebookPixelEvent(payment);
      if (pixelResult) {
        console.log(`Facebook Pixel event sent successfully for payment ${payment_id}`);
      } else {
        console.log(`Facebook Pixel event skipped for payment ${payment_id}`);
      }
    } catch (error: unknown) {
      console.error('Error sending Facebook Pixel event:', String(error));
      // Don't fail the webhook if Facebook Pixel fails
    }

    // Send Google Ads conversion event for approved payments
    try {
      const googleAdsResult: boolean = await sendGoogleAdsConversion(payment);
      if (googleAdsResult) {
        console.log(`Google Ads conversion sent successfully for payment ${payment_id}`);
      } else {
        console.log(`Google Ads conversion skipped for payment ${payment_id}`);
      }
    } catch (error: unknown) {
      console.error('Error sending Google Ads conversion:', String(error));
      // Don't fail the webhook if Google Ads fails
    }
  }

  // await sendWhatsappMessage(result.voucher); // TODO: finish whatsapp integration
  return new Response(
    JSON.stringify({ success: true, outcome: result.outcome }),
    {
      status: 200,
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-signature");
    const request_id = request.headers.get("x-request-id");
    const searchParams = request.nextUrl.searchParams;
    const dataID = searchParams.get("data.id");

    if (!signature) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing x-signature header" }),
        {
          status: 400,
        },
      );
    }

    if (!request_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing x-request-id header" }),
        {
          status: 400,
        },
      );
    }

    if (!dataID) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing data.id query param" }),
        {
          status: 400,
        },
      );
    }

    const payment_id = dataID;

    if (!isValidSignature(request_id, signature, dataID)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature" }),
        {
          status: 400,
        },
      );
    }

    return await validateVoucherPayment(payment_id);
  } catch (error: unknown) {
    console.error("Error processing webhook:", String(error));
    return new Response(
      JSON.stringify({ success: false, error: "Internal Server Error" }),
      {
        status: 500,
      },
    );
  }
}
