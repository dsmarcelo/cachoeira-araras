import { z } from "zod";
import { env } from "../_generated/server";
import type { ProviderIntent } from "./paymentOperation";

// Unlike the admin listing, financial operations must never interpret an HTTP
// error or malformed response as absence of payments or successful completion.
async function request(
  path: string,
  intent: ProviderIntent,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const token = env.MERCADOPAGO_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_TOKEN não está configurado.");
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": intent.idempotencyKey,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(`Mercado Pago API failed with ${response.status}`);
  return await response.json();
}

const providerId = z
  .union([z.string().min(1), z.number().int().nonnegative()])
  .transform(String);
const refundResponse = z.object({
  id: providerId,
  status: z.literal("approved"),
  amount: z.number().positive(),
});

/** Omitting amount requests a full refund; retries reuse the persisted intent key. */
export async function refundPayment(paymentId: string, intent: ProviderIntent) {
  return refundResponse.parse(
    await request(
      `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      intent,
      "POST",
      {},
    ),
  );
}

const paymentResponse = z
  .object({
    id: providerId,
    status: z.string().min(1),
    external_reference: z.string().nullish(),
    transaction_amount: z.number().nonnegative(),
    transaction_amount_refunded: z.number().nonnegative().optional(),
  })
  .transform((p) => ({
    id: p.id,
    status: p.status,
    externalReference: p.external_reference ?? null,
    amount: p.transaction_amount,
    refundedAmount: p.transaction_amount_refunded ?? 0,
  }));

const preferenceResponse = z.object({
  id: providerId,
  expires: z.boolean(),
  expiration_date_to: z.string().datetime({ offset: true }).nullable(),
});

/** Expiration is a repeatable state change, even where MP ignores idempotency headers. */
export async function invalidatePreference(
  preferenceId: string,
  intent: ProviderIntent,
) {
  const path = `/checkout/preferences/${encodeURIComponent(preferenceId)}`;
  const isExpired = (p: z.infer<typeof preferenceResponse>) =>
    p.id === preferenceId &&
    p.expires &&
    p.expiration_date_to !== null &&
    Date.parse(p.expiration_date_to) <= Date.now();
  const existing = preferenceResponse.parse(await request(path, intent));
  if (!isExpired(existing)) {
    // Both dates predate the intent; retries send exactly the same payload.
    const updated = preferenceResponse.parse(
      await request(path, intent, "PUT", {
        expires: true,
        expiration_date_from: new Date(intent.recordedAt - 2000).toISOString(),
        expiration_date_to: new Date(intent.recordedAt - 1000).toISOString(),
      }),
    );
    if (!isExpired(updated))
      throw new Error("Preference invalidation not confirmed");
  }
  return { id: preferenceId, invalidated: true as const };
}

/** No date/status filter: every attempt for this Voucher matters. Fail closed on incomplete scans. */
export async function findPaymentsByExternalReference(
  externalReference: string,
  intent: ProviderIntent,
) {
  const payments = new Map<string, z.infer<typeof paymentResponse>>();
  const pageResponse = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(paymentResponse),
  });
  for (let offset = 0; offset < 1000; offset += 50) {
    const params = new URLSearchParams({
      external_reference: externalReference,
      limit: "50",
      offset: String(offset),
      sort: "date_created",
      criteria: "asc",
    });
    const page = pageResponse.parse(
      await request(`/v1/payments/search?${params}`, intent),
    );
    for (const payment of page.results) {
      if (payment.externalReference !== externalReference)
        throw new Error("Unexpected payment reference");
      payments.set(payment.id, payment);
    }
    if (offset + page.results.length >= page.paging.total)
      return [...payments.values()];
    if (page.results.length < 50) throw new Error("Incomplete payment search");
  }
  throw new Error("Payment search exceeds safe scan limit");
}

function isCancellable(status: string) {
  return ["pending", "in_process", "authorized"].includes(status);
}

/** Re-read first to reconcile lost responses and preserve an approval racing cancellation. */
export async function cancelPayment(paymentId: string, intent: ProviderIntent) {
  const path = `/v1/payments/${encodeURIComponent(paymentId)}`;
  const readPayment = async () => {
    const payment = paymentResponse.parse(await request(path, intent));
    if (payment.id !== paymentId) throw new Error("Unexpected payment id");
    return payment;
  };
  const payment = await readPayment();
  if (!isCancellable(payment.status)) return payment;
  try {
    const updated = paymentResponse.parse(
      await request(path, intent, "PUT", { status: "cancelled" }),
    );
    if (updated.id !== paymentId || isCancellable(updated.status)) {
      throw new Error("Payment cancellation not confirmed");
    }
    return updated;
  } catch (error) {
    const reconciled = await readPayment();
    if (isCancellable(reconciled.status)) throw error;
    return reconciled;
  }
}
