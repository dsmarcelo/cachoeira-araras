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

function timingSafeEqualHex(expected: string, received: string): boolean {
  const hexPattern = /^[a-f0-9]+$/i;
  if (!hexPattern.test(expected) || !hexPattern.test(received)) return false;
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}
