import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
const token = process.env.MERCADOPAGO_TOKEN;

if (!token) {
  throw new Error("MERCADOPAGO_TOKEN is not set");
}

const client = new MercadoPagoConfig({
  accessToken: token,
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
        unit_price: z.number(),
        name: z.string(),
        surname: z.string(),
        phone: z.string().min(11),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const preference = new Preference(client);
        const response = await preference.create({
          body: {
            items: [
              {
                id: input.id,
                description: input.description,
                title: input.title || "Voucher",
                quantity: 1,
                unit_price: input.unit_price,
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
              success: "http://localhost:3000/pagamento/",
              failure: "http://localhost:3000/pagamento/",
              pending: "http://localhost:3000/pagamento/",
            },
            external_reference: input.code,
            expires: true,
            auto_return: "approved",
            expiration_date_from: new Date(Date.now()).toISOString(),
            expiration_date_to: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 7,
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
            notification_url: "www.cachoeiradasararas.com.br/api/webhook",
          },
        });
        console.log("🚀 ~ .mutation ~ response:", response);
        return response;
      } catch (error) {
        console.error("Error creating preference:", error);
        throw new Error("Failed to create preference");
      }
    }),
  getPreference: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch Preference");
        }
        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching Preference:", error);
        throw new Error("Failed to fetch Preference");
      }
    }),
  getPrefence: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.json();
    }),
  getPreferenceByEReference: publicProcedure
    .input(z.object({ external_reference: z.string().max(4) }))
    .query<PreferenceResponse>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/search?external_reference=${input.external_reference}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch Preference");
        }
        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching Preference:", error);
        throw new Error("Failed to fetch Preference");
      }
    }),
  getPayment: publicProcedure
    .input(z.object({ payment_id: z.string() }))
    .query<PaymentResponse>(async ({ input }) => {
      const url = `https://api.mercadopago.com/v1/payments/${input.payment_id}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch payment");
        }
        const data: PaymentResponse = (await res.json()) as PaymentResponse;
        return data;
      } catch (error) {
        console.error("Error fetching payment:", error);
        throw new Error("Failed to fetch payment");
      }
    }),
});
