import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { type PreferenceSchema } from "@/lib/utils/mercadopago/types";
import { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
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
                id: "voucher",
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
            auto_return: "approved",
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
          },
        });
        return response;
      } catch (error) {
        console.error("Error creating preference:", error);
        throw new Error("Failed to create preference");
      }
    }),
  getPreference: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceSchema>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 3600 },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch payment");
        }
        const data: PreferenceSchema = (await res.json()) as PreferenceSchema;
        return data;
      } catch (error) {
        console.error("Error fetching payment:", error);
        throw new Error("Failed to fetch payment");
      }
    }),
  getPayment: publicProcedure
    .input(z.object({ payment_id: z.string() }))
    .query<PaymentResponse>(async ({ input }) => {
      const url = `https://api.mercadopago.com/v1/payments/${input.payment_id}`;
      // const pm = await Payment.prototype.get({ id: input.payment_id });
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 3600 },
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
