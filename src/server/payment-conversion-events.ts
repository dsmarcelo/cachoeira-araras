import "server-only";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { capturePaymentFlowException } from "@/lib/sentry/payment";

export async function sendPaymentConversionEvents(
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
    capturePaymentFlowException(error, "webhook", {
      paymentId: payment_id,
      integration: "facebook_pixel",
    });
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
    capturePaymentFlowException(error, "webhook", {
      paymentId: payment_id,
      integration: "google_ads",
    });
    console.error("Error sending Google Ads conversion:", String(error));
    // Don't fail the webhook if Google Ads fails
  }
}
