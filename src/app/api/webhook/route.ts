import { env } from "@/env";
import { type NextRequest } from "next/server";
import * as crypto from "crypto";
import { sendFacebookPixelEvent, sendGoogleAdsConversion } from "@/lib/utils/webhook-pixel";
import { getMercadoPagoPayment } from "@/server/mercadopago";
import { findVoucherByCode, updateVoucherByCode } from "@/server/voucher";
// import { sendWhatsappMessage } from "@/app/lib";

const WEBHOOK_SECRET = env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET is not set");
}

function isValidSignature(
  request_id: string,
  signature: string,
  dataID: string,
): boolean {
  if (!WEBHOOK_SECRET) {
    throw new Error("WEBHOOK_SECRET is not set");
  }

  const parts = signature.split(",");

  let ts;
  let hash;

  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (trimmedKey === "ts") {
        ts = trimmedValue;
      } else if (trimmedKey === "v1") {
        hash = trimmedValue;
      }
    }
  });
  const manifest = `id:${dataID};request-id:${request_id};ts:${ts};`;

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(manifest);
  const digest = hmac.digest("hex");
  return hash === digest;
}

async function validadeVoucherPayment(payment_id: string) {
  const payment = await getMercadoPagoPayment(payment_id);
  if (!payment) return null;

  const code = payment.external_reference;
  if (!code || typeof code !== "string")
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );

  const voucher = await findVoucherByCode(code);
  if (voucher?.status === "redeemed") return null;

  if (payment.status === "approved") {
    const voucher = await updateVoucherByCode(code, {
      status: "valid",
      valid: true,
      payment_id: payment_id,
    });

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

    // await sendWhatsappMessage(voucher); // TODO: finish whatsapp integration
    return new Response(JSON.stringify({ voucher }), {
      status: 200,
    });
  } else {
    if (code) {
      const voucher = await updateVoucherByCode(code, {
        payment_id: payment_id,
      });
      return new Response(JSON.stringify({ voucher }), {
        status: 200,
      });
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-signature")!;
    const request_id = request.headers.get("x-request-id")!;
    const searchParams = request.nextUrl.searchParams;

    const dataID = searchParams.get("data.id")!;
    const payment_id = dataID;

    if (!isValidSignature(request_id, signature, dataID)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature" }),
        {
          status: 400,
        },
      );
    }

    const res = await validadeVoucherPayment(payment_id);
    if (!res)
      return new Response(JSON.stringify({ success: false }), {
        status: 404,
      });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
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
