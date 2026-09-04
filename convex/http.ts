import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifyServiceSecret } from "./lib/serviceAuth";

const http = httpRouter();

/**
 * Confirms a Mercado Pago payment against the voucher it paid for. The only
 * caller is the Next.js webhook route (src/app/api/webhook/route.ts, kept
 * there because live Mercado Pago preferences have that URL baked in), which
 * has already verified Mercado Pago's HMAC signature before ever reaching
 * this endpoint. Trust here comes solely from the `x-webhook-secret` header
 * matching `MERCADOPAGO_WEBHOOK_SERVICE_SECRET` (Convex env, set via
 * `npx convex env set`) — no Convex identity is involved, so a signed-in
 * admin session can't reach this path at all.
 */
http.route({
  path: "/webhooks/mercadopago/confirmPayment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorized = await verifyServiceSecret(
      request.headers.get("x-webhook-secret"),
    );
    if (!authorized) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null) {
      return new Response("Bad Request", { status: 400 });
    }
    const { code, paymentId, paymentStatus } = body as Record<
      string,
      unknown
    >;
    if (typeof code !== "string" || typeof paymentId !== "string") {
      return new Response("Bad Request", { status: 400 });
    }
    if (paymentStatus !== null && typeof paymentStatus !== "string") {
      return new Response("Bad Request", { status: 400 });
    }

    const result = await ctx.runMutation(internal.vouchers.confirmPayment, {
      code,
      paymentId,
      paymentStatus,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
