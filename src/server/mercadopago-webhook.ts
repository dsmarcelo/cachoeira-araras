import * as crypto from "crypto";

type MercadoPagoSignatureParts = {
  ts: string;
  hash: string;
};

type VerifyMercadoPagoWebhookSignatureInput = {
  dataId: string;
  requestId?: string | null;
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
  sendIdempotentConversionEvents?: (
    payment: MercadoPagoPaymentWebhookPayload,
    paymentId: string,
  ) => Promise<void>;
  logger?: Pick<Console, "warn">;
};

type ResolveMercadoPagoWebhookDataInput = {
  searchParams: URLSearchParams;
  body?: unknown;
};

export type ResolvedMercadoPagoWebhookData = {
  dataId: string | null;
  type: string | null;
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
  if (!dataId) return false;

  const signatureParts = parseMercadoPagoSignature(signature);
  if (!signatureParts) return false;

  const manifest = buildMercadoPagoSignatureManifest({
    dataId,
    requestId,
    ts: signatureParts.ts,
  });
  const digest = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return timingSafeEqualHex(digest, signatureParts.hash);
}

export function buildMercadoPagoSignatureManifest({
  dataId,
  requestId,
  ts,
}: {
  dataId?: string | null;
  requestId?: string | null;
  ts?: string | null;
}): string {
  let manifest = "";

  if (dataId) {
    manifest += `id:${dataId.toLowerCase()};`;
  }

  if (requestId) {
    manifest += `request-id:${requestId};`;
  }

  if (ts) {
    manifest += `ts:${ts};`;
  }

  return manifest;
}

export function resolveMercadoPagoWebhookData({
  searchParams,
  body,
}: ResolveMercadoPagoWebhookDataInput): ResolvedMercadoPagoWebhookData {
  const webhookBody = isRecord(body) ? body : null;
  const data = isRecord(webhookBody?.data) ? webhookBody.data : null;

  return {
    dataId: searchParams.get("data.id") ?? readString(data?.id),
    type: searchParams.get("type") ?? readString(webhookBody?.type),
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export async function processMercadoPagoPaymentWebhook({
  dataId,
  type,
  getPayment,
  processVoucherPayment,
  sendConversionEvents,
  sendIdempotentConversionEvents,
  logger = console,
}: ProcessMercadoPagoPaymentWebhookInput): Promise<ProcessMercadoPagoPaymentWebhookResult> {
  if (normalizeWebhookType(type) !== "payment") {
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

  if (isApprovedPayment(payment.status)) {
    await sendIdempotentConversionEvents?.(payment, dataId);
  }

  return {
    status: 200,
    body: {
      success: true,
      outcome: result.outcome,
    },
  };
}

function normalizeWebhookType(type: string | null): string | null {
  if (!type) return null;
  return type.trim().toLowerCase();
}

function isApprovedPayment(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === "approved";
}

function timingSafeEqualHex(expected: string, received: string): boolean {
  const hexPattern = /^[a-f0-9]+$/i;
  if (!hexPattern.test(expected) || !hexPattern.test(received)) return false;
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(
    Uint8Array.from(Buffer.from(expected, "hex")),
    Uint8Array.from(Buffer.from(received, "hex")),
  );
}
