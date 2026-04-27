import * as crypto from "crypto";

type MercadoPagoSignatureParts = {
  ts: string;
  hash: string;
};

type VerifyMercadoPagoWebhookSignatureInput = {
  dataId: string;
  requestId: string;
  secret: string;
  signature: string;
};

type VoucherPaymentWebhookResult =
  | {
      outcome: "not_found";
      shouldSendConversionEvents: false;
    }
  | {
      outcome: "already_processed" | "redeemed" | "updated";
      shouldSendConversionEvents: boolean;
    };

type MercadoPagoPaymentWebhookPayload = {
  external_reference?: unknown;
  status?: string | null;
};

type ProcessMercadoPagoPaymentWebhookInput = {
  dataId: string;
  type: string | null;
  getPayment: (
    paymentId: string,
  ) => Promise<MercadoPagoPaymentWebhookPayload | null>;
  processVoucherPayment: (input: {
    code: string;
    paymentId: string;
    paymentStatus: string | null | undefined;
  }) => Promise<VoucherPaymentWebhookResult>;
  sendConversionEvents?: (
    payment: MercadoPagoPaymentWebhookPayload,
    paymentId: string,
  ) => Promise<void>;
  logger?: Pick<Console, "warn">;
};

export type MercadoPagoPaymentWebhookOutcome =
  | "ignored"
  | "payment_not_found"
  | "voucher_not_found"
  | "already_processed"
  | "redeemed"
  | "updated";

export type MercadoPagoPaymentWebhookResponse = {
  success: boolean;
  outcome: MercadoPagoPaymentWebhookOutcome;
};

export type ProcessMercadoPagoPaymentWebhookResult = {
  status: 200;
  body: MercadoPagoPaymentWebhookResponse;
};

export function verifyMercadoPagoWebhookSignature({
  dataId,
  requestId,
  secret,
  signature,
}: VerifyMercadoPagoWebhookSignatureInput): boolean {
  const signatureParts = parseMercadoPagoSignature(signature);
  if (!signatureParts) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${signatureParts.ts};`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return timingSafeEqualHex(digest, signatureParts.hash);
}

export function parseMercadoPagoSignature(
  signature: string,
): MercadoPagoSignatureParts | null {
  const signatureParts = signature.split(",");

  let ts: string | undefined;
  let hash: string | undefined;

  signatureParts.forEach((part) => {
    const [key, value] = part.split("=", 2);
    if (!key || !value) return;

    const trimmedKey = key.trim();
    const trimmedValue = value.trim();

    if (trimmedKey === "ts") {
      ts = trimmedValue;
    } else if (trimmedKey === "v1") {
      hash = trimmedValue;
    }
  });

  if (!ts || !hash) return null;

  return { ts, hash };
}

export async function processMercadoPagoPaymentWebhook({
  dataId,
  type,
  getPayment,
  processVoucherPayment,
  sendConversionEvents,
  logger = console,
}: ProcessMercadoPagoPaymentWebhookInput): Promise<ProcessMercadoPagoPaymentWebhookResult> {
  if (type !== "payment") {
    return {
      status: 200,
      body: {
        success: true,
        outcome: "ignored",
      },
    };
  }

  const payment = await getPayment(dataId);
  if (!payment) {
    logger.warn(`Mercado Pago webhook payment not found: ${dataId}`);
    return {
      status: 200,
      body: {
        success: false,
        outcome: "payment_not_found",
      },
    };
  }

  const code = payment.external_reference;
  if (!code || typeof code !== "string") {
    logger.warn(`Mercado Pago webhook missing voucher reference: ${dataId}`);
    return {
      status: 200,
      body: {
        success: false,
        outcome: "voucher_not_found",
      },
    };
  }

  const result = await processVoucherPayment({
    code,
    paymentId: dataId,
    paymentStatus: payment.status,
  });

  if (result.outcome === "not_found") {
    logger.warn(`Mercado Pago webhook voucher not found: ${code}`);
    return {
      status: 200,
      body: {
        success: false,
        outcome: "voucher_not_found",
      },
    };
  }

  if (result.shouldSendConversionEvents) {
    await sendConversionEvents?.(payment, dataId);
  }

  return {
    status: 200,
    body: {
      success: true,
      outcome: result.outcome,
    },
  };
}

function timingSafeEqualHex(expected: string, received: string): boolean {
  const hexPattern = /^[a-f0-9]+$/i;
  if (!hexPattern.test(expected) || !hexPattern.test(received)) return false;
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}
