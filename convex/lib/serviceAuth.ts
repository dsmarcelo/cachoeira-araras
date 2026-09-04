/**
 * Verifies the shared secret a machine-to-machine caller presents (e.g. the
 * Mercado Pago webhook route via convex/http.ts), instead of a Convex
 * identity. There is no admin-equivalent token minted for these callers —
 * the secret itself is the credential.
 *
 * Both sides are SHA-256 hashed to a fixed 32-byte digest first, so a
 * `received` value of a different length never short-circuits the
 * comparison, then compared byte-by-byte with a running OR rather than a
 * short-circuiting `===` — so neither the secret's length nor its content
 * leaks through response timing.
 */
export async function verifyServiceSecret(
  received: string | null,
): Promise<boolean> {
  const expected = process.env.MERCADOPAGO_WEBHOOK_SERVICE_SECRET;
  if (!expected) {
    throw new Error("MERCADOPAGO_WEBHOOK_SERVICE_SECRET is not set");
  }
  if (received === null) {
    return false;
  }

  const [expectedDigest, receivedDigest] = await Promise.all([
    sha256(expected),
    sha256(received),
  ]);

  let diff = 0;
  for (let i = 0; i < expectedDigest.length; i += 1) {
    diff |= expectedDigest[i]! ^ receivedDigest[i]!;
  }
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}
