import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import { z } from "zod";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { getAllSettings } from "@/lib/settings";
import { validateVoucherPurchase } from "@/server/voucher-purchase";

/** Strip trailing slashes so `${base}/pagamento/` never doubles slashes. */
function normalizePublicBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Public origin for Mercado Pago `back_urls`. Prefer validated `env.URL`; if it is empty
 * (e.g. `SKIP_ENV_VALIDATION` builds), keep the same fallbacks the router used before.
 */
function resolveSiteBaseForCheckout(): string {
  const primary = (env.URL ?? "").trim();
  if (primary) return normalizePublicBaseUrl(primary);
  if (env.NEXT_PUBLIC_VERCEL_URL?.trim()) {
    return normalizePublicBaseUrl(`https://${env.NEXT_PUBLIC_VERCEL_URL.trim()}`);
  }
  if (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return normalizePublicBaseUrl(
      `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL.trim()}`,
    );
  }
  return "http://localhost:3000";
}

const client = new MercadoPagoConfig({
  accessToken: env.MERCADOPAGO_TOKEN,
  options: { timeout: 5000, idempotencyKey: "abc" },
});

function formatPhone(phone: string) {
  const formatedPhone: Record<string, string> = {};
  formatedPhone.area_code = phone.substring(0, 2);
  formatedPhone.number = phone.substring(2);
  return formatedPhone;
}

export const mercadopagoRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        code: z.string(),
        id: z.string(),
        title: z.string(),
        description: z.string(),
        adults: z.number(),
        elderly: z.number(),
        adults_pool: z.number(),
        elderly_pool: z.number(),
        intendedDate: z.date(),
        testMode: z.boolean().optional().default(false),
        name: z.string(),
        surname: z.string(),
        phone: z.string().min(11),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await getAllSettings();
        const validation = validateVoucherPurchase(
          {
            adults: input.adults,
            elderly: input.elderly,
            adults_pool: input.adults_pool,
            elderly_pool: input.elderly_pool,
            intendedDate: input.intendedDate,
            testMode: input.testMode,
          },
          {
            canUseTestMode:
              ctx.session?.user.role === "admin" ||
              ctx.session?.user.role === "employee",
            settings,
          },
        );
        const siteBase = resolveSiteBaseForCheckout();
        const webhookBase = normalizePublicBaseUrl(env.WEBHOOK_URL);
        const preference = new Preference(client);
        const response = await preference.create({
          body: {
            items: [
              {
                id: input.id,
                description: input.description,
                title: input.title || "Voucher",
                quantity: 1,
                unit_price: validation.price,
                currency_id: "BRL",
              },
            ],
            payer: {
              name: input.name,
              surname: input.surname,
              phone: {
                area_code: formatPhone(input.phone).area_code,
                number: formatPhone(input.phone).number,
              },
            },
            back_urls: {
              success: `${siteBase}/pagamento/`,
              failure: `${siteBase}/pagamento/`,
              pending: `${siteBase}/pagamento/`,
            },
            external_reference: input.code,
            expires: true,
            auto_return: "approved",
            expiration_date_from: new Date(Date.now()).toISOString(),
            expiration_date_to: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 10,
            ).toISOString(),
            payment_methods: {
              excluded_payment_methods: [
                {
                  id: "bolbradesco",
                },
                {
                  id: "pec",
                },
              ],
            },
            statement_descriptor: "Cachoeira das Araras",
            notification_url: `${webhookBase}/api/webhook`,
          },
        });
        return response;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error creating preference:", error);
        throw new Error("Failed to create preference");
      }
    }),
  getPreference: adminProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
        },
      });

      if (!res.ok) {
        return undefined;
      }
      const data = (await res.json()) as PreferenceResponse;
      return data;
    }),
  getPublicPreference: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<{ init_point: string | null }>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
        },
      });

      if (!res.ok) {
        return {
          init_point: null,
        };
      }

      const data = (await res.json()) as PreferenceResponse;

      return {
        init_point: data.init_point ?? null,
      };
    }),
  getPreferenceByEReference: adminProcedure
    .input(z.object({ external_reference: z.string().max(4) }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/search?external_reference=${input.external_reference}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
          },
        });

        if (!res.ok) {
          return undefined;
        }
        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching Preference:", error);
        throw new Error("Failed to fetch Preference");
      }
    }),
  getPayment: adminProcedure
    .input(z.object({ payment_id: z.string() }))
    .query<PaymentResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/v1/payments/${input.payment_id}`;
      // try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
        },
      });

      if (!res.ok) {
        return undefined;
      }
      const data: PaymentResponse = (await res.json()) as PaymentResponse;
      return data;
      // } catch (error) {
      //   console.error("Error fetching payment:", error);
      //   throw new Error("Failed to fetch payment");
      // }
    }),
});
