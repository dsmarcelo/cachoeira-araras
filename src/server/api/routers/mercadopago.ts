import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { MercadoPagoConfig, Preference } from 'mercadopago';
const token = process.env.MERCADOPAGO_TOKEN
const client = new MercadoPagoConfig({ accessToken: token ?? ''});

export const mercadopagoRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({
      title: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const preference = await new Preference(client).create({
          body: {
            items: [
              {
                id: 'voucher',
                title: input.title || 'title',
                quantity: 4,
                unit_price: 50,
              }
            ],
          }
        })
        return preference;
      } catch (error) {
        console.error('Error creating preference:', error);
        throw new Error('Failed to create preference');
      }
    }),
});
