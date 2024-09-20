import { type NextRequest } from "next/server";
import crypto from "crypto";
import { api } from "@/trpc/server";
import { sendWhatsappMessage } from "@/app/lib";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "your-secret-key";

function isValidSignature(
  request_id: string,
  signature: string,
  dataID: string,
): boolean {
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
  const payment = await api.mercadopago.getPayment({ payment_id });
  if (!payment) return null;

  const code = payment.external_reference;
  if (!code || typeof code !== "string")
    return new Response(
      JSON.stringify({ success: false, error: "Voucher not found" }),
      {
        status: 404,
      },
    );

  const voucher = await api.voucher.findByCode({ code });
  if (voucher?.status === "redeemed") return null;

  if (payment.status === "approved") {
    const voucher = await api.voucher.update({
      where: { code },
      data: {
        status: "valid",
        valid: true,
        payment_id: payment_id,
      },
    });
    await sendWhatsappMessage(voucher);
    return new Response(JSON.stringify({ voucher }), {
      status: 200,
    });
  } else {
    if (code) {
      const voucher = await api.voucher.update({
        where: { code },
        data: {
          payment_id: payment_id,
        },
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
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal Server Error" }),
      {
        status: 500,
      },
    );
  }
}
