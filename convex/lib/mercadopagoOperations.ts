import { z } from "zod";
import { env } from "../_generated/server";
import { buildMercadoPagoWebhookUrl } from "../../src/server/mercadopago-checkout";
import type { CreatePaymentRequest, ProviderIntent } from "./paymentOperation";
import { siteUrl } from "./siteUrl";
import { MercadoPagoApiError } from "./mercadopagoError";

function safeProviderDetail(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 200);
}

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
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const details =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    throw new MercadoPagoApiError(
      response.status,
      safeProviderDetail(details?.error),
      safeProviderDetail(details?.message),
    );
  }
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
    payment_type_id: z.string().nullish(),
    payment_method_id: z.string().nullish(),
    status_detail: z.string().nullish(),
    currency_id: z.string().nullish(),
    date_of_expiration: z.string().datetime({ offset: true }).nullish(),
    three_ds_info: z
      .object({
        external_resource_url: z.string().min(1),
        creq: z.string().min(1),
      })
      .partial()
      .nullish(),
    point_of_interaction: z
      .object({
        transaction_data: z
          .object({
            qr_code: z.string().min(1),
            qr_code_base64: z.string().min(1),
          })
          .partial()
          .nullish(),
      })
      .nullish(),
  })
  .transform((p) => ({
    id: p.id,
    status: p.status,
    externalReference: p.external_reference ?? null,
    amount: p.transaction_amount,
    refundedAmount: p.transaction_amount_refunded ?? 0,
    ...(p.payment_type_id ? { paymentTypeId: p.payment_type_id } : {}),
    ...(p.payment_method_id ? { paymentMethodId: p.payment_method_id } : {}),
    ...(p.status_detail ? { statusDetail: p.status_detail } : {}),
    ...(p.currency_id ? { currency: p.currency_id } : {}),
    ...(p.date_of_expiration
      ? { expiresAt: Date.parse(p.date_of_expiration) }
      : {}),
    ...(p.point_of_interaction?.transaction_data?.qr_code &&
    p.point_of_interaction.transaction_data.qr_code_base64
      ? {
          pix: {
            qrCode: p.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64:
              p.point_of_interaction.transaction_data.qr_code_base64,
          },
        }
      : {}),
    ...(p.three_ds_info?.external_resource_url && p.three_ds_info.creq
      ? {
          challenge: {
            externalResourceUrl: p.three_ds_info.external_resource_url,
            creq: p.three_ds_info.creq,
          },
        }
      : {}),
  }));

/** Read the authoritative amount and ownership before an admin refund. */
export async function getPayment(paymentId: string, intent: ProviderIntent) {
  const payment = paymentResponse.parse(
    await request(`/v1/payments/${encodeURIComponent(paymentId)}`, intent),
  );
  if (payment.id !== paymentId) throw new Error("Unexpected payment id");
  return payment;
}

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

/**
 * Creates a Pix charge for the server-derived amount. The idempotency key makes
 * a retry after a lost response return the original charge instead of a new one.
 * A pending Pix without QR data is unusable, so it is rejected as malformed.
 */
export async function createPayment(
  input: CreatePaymentRequest,
  intent: ProviderIntent,
) {
  const created = paymentResponse.parse(
    await request("/v1/payments", intent, "POST", {
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: input.paymentMethodId,
      external_reference: input.externalReference,
      payer: input.payer,
      ...(input.card
        ? {
            token: input.card.token,
            installments: input.card.installments,
            ...(input.card.issuerId ? { issuer_id: input.card.issuerId } : {}),
            three_d_secure_mode: "optional",
          }
        : {}),
      ...(input.expiresAt !== undefined
        ? { date_of_expiration: new Date(input.expiresAt).toISOString() }
        : {}),
      notification_url: buildMercadoPagoWebhookUrl(siteUrl),
      statement_descriptor: "Cachoeira das Araras",
    }),
  );
  if (!input.card && created.status === "pending" && created.pix === undefined)
    throw new Error("Pix charge response is missing its QR code");
  return created;
}
