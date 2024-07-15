import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { MercadoPagoConfig, Preference } from "mercadopago";
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
              success: "http://localhost:3000/pagamento/aprovado",
              failure: "http://localhost:3000/pagamento/recusado",
              pending: "http://localhost:3000/pagamento/recusado",
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
  getPayment: publicProcedure
    .input(
      z.object({
        payment_id: z.string(),
        status: z.string(),
        merchant_order_id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return {
        Payment: input.payment_id,
        Status: input.status,
        MerchantOrder: input.merchant_order_id,
      };
    }),
});
