import { type NextRequest } from "next/server";
import * as crypto from "crypto";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";
import { createServerCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { env } from "@/env";

const MERCADO_PAGO_WEBHOOK_SECRET = env.WEBHOOK_SECRET ?? "";
const GETNET_WEBHOOK_SECRET = env.GETNET_WEBHOOK_SECRET ?? "";

function isValidMercadoPagoSignature(
  request_id: string,
  signature: string,
  dataID: string,
): boolean {
  // Mercado Pago sends the signature as "ts=<timestamp>,v1=<hash>".
  // We split the header and rebuild the manifest string documented in the
  // webhook docs to verify the HMAC using the shared secret (`WEBHOOK_SECRET`).
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

  const hmac = crypto.createHmac("sha256", MERCADO_PAGO_WEBHOOK_SECRET);
  hmac.update(manifest);
  const digest = hmac.digest("hex");
  return hash === digest;
}

function isValidGetnetSignature(headers: Headers, rawBody: string): boolean {
  // Getnet signs the entire request payload with `x-gnet-signature` using
  // HMAC-SHA256. When the secret is not configured we log a warning and
  // proceed to avoid accidental production outages.
  if (!GETNET_WEBHOOK_SECRET) {
    console.warn(
      "GETNET_WEBHOOK_SECRET is not configured. Skipping signature validation.",
    );
    return true;
  }

  const providedSignature = headers.get("x-gnet-signature") ?? "";
  if (!providedSignature) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", GETNET_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature),
  );
}

async function createCallerFromRequest(request: NextRequest) {
  // Build a tRPC caller bound to the current request headers, allowing us to
  // reuse the existing routers inside the API route without importing the
  // client-specific helpers.
  const context = await createTRPCContext({ headers: request.headers });
  return createServerCaller(context);
}

async function validadeVoucherPayment(
  caller: ReturnType<typeof createServerCaller>,
  payment_id: string,
) {
  // Mercado Pago sends the `data.id` referencing the payment. We re-fetch the
  // payment to confirm its status and update the voucher accordingly.
  const payment = await caller.mercadopago.getPayment({ payment_id });
  if (!payment) return null;

  const code = payment.external_reference;
  if (!code || typeof code !== "string")
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );

  const voucher = await caller.voucher.findByCode({ code });
  if (!voucher) {
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );
  }

  if (voucher.status === "redeemed") return null;

  if (payment.status === "approved") {
    // Persist the successful payment information so the voucher becomes valid.
    const updatedVoucher = await caller.voucher.update({
      where: { code },
      data: {
        status: "valid",
        valid: true,
        payment_id: payment_id,
      },
    });

    try {
      const pixelResult = await sendFacebookPixelEvent(payment);
      if (pixelResult) {
        console.log(
          `Facebook Pixel event sent successfully for payment ${payment_id}`,
        );
      } else {
        console.log(`Facebook Pixel event skipped for payment ${payment_id}`);
      }
    } catch (error: unknown) {
      console.error("Error sending Facebook Pixel event:", String(error));
    }

    try {
      const googleAdsResult = await sendGoogleAdsConversion(payment);
      if (googleAdsResult) {
        console.log(
          `Google Ads conversion sent successfully for payment ${payment_id}`,
        );
      } else {
        console.log(`Google Ads conversion skipped for payment ${payment_id}`);
      }
    } catch (error: unknown) {
      console.error("Error sending Google Ads conversion:", String(error));
    }

    return new Response(JSON.stringify({ voucher: updatedVoucher }), {
      status: 200,
    });
  }

  if (code) {
    const updatedVoucher = await caller.voucher.update({
      where: { code },
      data: {
        payment_id: payment_id,
      },
    });
    return new Response(JSON.stringify({ voucher: updatedVoucher }), {
      status: 200,
    });
  }

  return null;
}

async function updateVoucherStatusFromGetnet(
  caller: ReturnType<typeof createServerCaller>,
  payload: {
    charge_uuid?: string;
    order_id?: string;
    status?: string;
  },
) {
  // The Getnet notification references the original order (voucher code).
  // We make sure the order id is present to avoid updating the wrong record.
  if (!payload.order_id) {
    throw new Error("Getnet payload missing order_id");
  }

  const voucher = await caller.voucher.findByCode({ code: payload.order_id });
  if (!voucher) {
    throw new Error(`Voucher not found for code ${payload.order_id}`);
  }

  // Normalize status to avoid casing differences between environments.
  const normalizedStatus = payload.status?.toUpperCase();
  const isApproved =
    normalizedStatus === "PAID" ||
    normalizedStatus === "APPROVED" ||
    normalizedStatus === "CAPTURED";

  // Update only the fields impacted by the webhook to keep history intact for
  // other attributes managed elsewhere (e.g., intended date edits via admin).
  const updatedVoucher = await caller.voucher.update({
    where: { code: payload.order_id },
    data: {
      status: isApproved ? "valid" : voucher.status,
      valid: isApproved ? true : voucher.valid,
      payment_id: payload.charge_uuid ?? voucher.payment_id ?? undefined,
    },
  });

  return new Response(JSON.stringify({ voucher: updatedVoucher }), {
    status: 200,
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers = request.headers;
    const caller = await createCallerFromRequest(request);

    const isGetnetRequest = headers.get("x-gnet-signature") !== null;

    if (isGetnetRequest) {
      if (!isValidGetnetSignature(headers, rawBody)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid Getnet signature" }),
          {
            status: 400,
          },
        );
      }

      const payload = JSON.parse(rawBody) as {
        charge_uuid?: string;
        order_id?: string;
        status?: string;
      };
      const response = await updateVoucherStatusFromGetnet(caller, payload);
      return (
        response ??
        new Response(JSON.stringify({ success: false }), { status: 404 })
      );
    }

    const signature = headers.get("x-signature") ?? "";
    const request_id = headers.get("x-request-id") ?? "";
    const searchParams = request.nextUrl.searchParams;

    const dataID = searchParams.get("data.id") ?? "";
    const payment_id = dataID;

    // When the Mercado Pago secret is configured, enforce signature validation
    // to prevent forged webhook calls. For local development we allow tests to
    // proceed without the header.
    if (
      MERCADO_PAGO_WEBHOOK_SECRET &&
      (!signature ||
        !request_id ||
        !dataID ||
        !isValidMercadoPagoSignature(request_id, signature, dataID))
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature" }),
        {
          status: 400,
        },
      );
    }

    const res = await validadeVoucherPayment(caller, payment_id);
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
