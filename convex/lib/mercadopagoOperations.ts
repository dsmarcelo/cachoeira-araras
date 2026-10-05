import { z } from "zod";
import { env } from "../_generated/server";
import type { ProviderIntent } from "./paymentOperation";
import { MercadoPagoApiError } from "./mercadopagoError";
import type { ChargebackOutcome } from "./paymentReversal";

function safeProviderDetail(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 200);
}

/**
 * Reads (GET) give up after this long, so a stalled provider becomes a
 * failure the caller handles (Validar reports "could not confirm" and still
 * lets staff redeem) instead of a hang. It sits under the gate UI's own safety
 * timeout. Writes are never aborted client-side: a refund or preference update
 * may already be applied, and retries rely on idempotency keys.
 * `AbortController` + `setTimeout` rather than `AbortSignal.timeout`, which
 * the Convex runtime may not provide.
 */
export const PROVIDER_READ_TIMEOUT_MS = 10_000;

// Unlike the admin listing, financial operations must never interpret an HTTP
// error or malformed response as absence of payments or successful completion.
async function request(
  path: string,
  intent?: ProviderIntent,
  method = "GET",
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const token = env.MERCADOPAGO_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_TOKEN não está configurado.");
  const controller = new AbortController();
  const timer =
    method === "GET"
      ? setTimeout(() => controller.abort(), PROVIDER_READ_TIMEOUT_MS)
      : undefined;
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Read-only lookups carry no intent and need no idempotency key.
        ...(intent ? { "X-Idempotency-Key": intent.idempotencyKey } : {}),
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const details =
        errorBody && typeof errorBody === "object" && !Array.isArray(errorBody)
          ? (errorBody as Record<string, unknown>)
          : null;
      throw new MercadoPagoApiError(
        response.status,
        safeProviderDetail(details?.error),
        safeProviderDetail(details?.message),
      );
    }
    // The timer stays armed until the body is read, so a stalled body aborts too.
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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
    status_detail: z.string().min(1).nullish(),
    external_reference: z.string().nullish(),
    transaction_amount: z.number().nonnegative(),
    transaction_amount_refunded: z.number().nonnegative().optional(),
    payment_type_id: z.string().nullish(),
    payment_method_id: z.string().nullish(),
  })
  .transform((p) => ({
    id: p.id,
    status: p.status,
    externalReference: p.external_reference ?? null,
    amount: p.transaction_amount,
    refundedAmount: p.transaction_amount_refunded ?? 0,
    // MP reports reais; downstream code only handles integer cents.
    ...(p.transaction_amount_refunded === undefined
      ? {}
      : { refundedCents: Math.round(p.transaction_amount_refunded * 100) }),
    ...(p.status_detail ? { statusDetail: p.status_detail } : {}),
    ...(p.payment_type_id ? { paymentTypeId: p.payment_type_id } : {}),
    ...(p.payment_method_id ? { paymentMethodId: p.payment_method_id } : {}),
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

const MAX_SEARCH_OFFSET = 2000;

/**
 * Payments whose provider-side `date_last_updated` falls in [beginMs, endMs]
 * (epoch ms), oldest update first. Fails on incomplete or oversized scans;
 * an error never means "nothing changed".
 */
export async function searchPaymentsUpdatedBetween(
  beginMs: number,
  endMs: number,
) {
  if (!Number.isFinite(beginMs) || !Number.isFinite(endMs) || beginMs > endMs)
    throw new Error("Invalid payment search window");
  const payments = new Map<string, z.infer<typeof paymentResponse>>();
  const pageResponse = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(paymentResponse),
  });
  for (let offset = 0; offset < MAX_SEARCH_OFFSET; offset += 50) {
    const params = new URLSearchParams({
      range: "date_last_updated",
      begin_date: new Date(beginMs).toISOString(),
      end_date: new Date(endMs).toISOString(),
      limit: "50",
      offset: String(offset),
      sort: "date_last_updated",
      criteria: "asc",
    });
    const page = pageResponse.parse(
      await request(`/v1/payments/search?${params}`),
    );
    for (const payment of page.results) payments.set(payment.id, payment);
    if (offset + page.results.length >= page.paging.total)
      return [...payments.values()];
    if (page.results.length < 50) throw new Error("Incomplete payment search");
  }
  throw new Error("Payment search exceeds safe scan limit");
}

const chargebackCase = z
  .object({
    id: providerId,
    coverage_applied: z.boolean().nullish(),
    date_created: z.string().nullish(),
    date_last_updated: z.string().nullish(),
  })
  .transform((c) => ({
    id: c.id,
    coverageApplied: c.coverage_applied ?? null,
    dateCreated: c.date_created ?? null,
    dateLastUpdated: c.date_last_updated ?? null,
  }));
export type ChargebackCase = z.infer<typeof chargebackCase>;

/**
 * MP documents `X-Caller-Id` (seller id) as required on /v1/chargebacks/search,
 * so it is derived from the token's own user (GET /users/me) on each call.
 */
async function getSellerId() {
  const me = z.object({ id: providerId }).parse(await request("/users/me"));
  return me.id;
}

/** All chargeback cases for a payment. Errors and malformed pages throw, never "no cases". */
export async function findChargebacksByPayment(paymentId: string) {
  const callerId = await getSellerId();
  const cases = new Map<string, ChargebackCase>();
  const pageResponse = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(chargebackCase),
  });
  for (let offset = 0; offset < 200; ) {
    const params = new URLSearchParams({
      payment_id: paymentId,
      limit: "50",
      offset: String(offset),
    });
    const page = pageResponse.parse(
      await request(
        `/v1/chargebacks/search?${params}`,
        undefined,
        "GET",
        undefined,
        { "X-Caller-Id": callerId },
      ),
    );
    for (const c of page.results) cases.set(c.id, c);
    offset += page.results.length;
    if (offset >= page.paging.total) return [...cases.values()];
    if (page.results.length === 0)
      throw new Error("Incomplete chargeback search");
  }
  throw new Error("Chargeback search exceeds safe scan limit");
}

/**
 * Outcome of the most recent case (`date_last_updated`, else `date_created`):
 * `coverage_applied` true = won, false = lost, null = still open.
 * `undefined` when there are no cases.
 */
export function chargebackOutcome(
  cases: readonly ChargebackCase[],
): ChargebackOutcome | undefined {
  const recency = (c: ChargebackCase) => {
    const time = Date.parse(c.dateLastUpdated ?? c.dateCreated ?? "");
    return Number.isNaN(time) ? 0 : time;
  };
  let latest: ChargebackCase | undefined;
  for (const c of cases)
    if (!latest || recency(c) > recency(latest)) latest = c;
  if (!latest) return undefined;
  if (latest.coverageApplied === null) return "open";
  return latest.coverageApplied ? "won" : "lost";
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
