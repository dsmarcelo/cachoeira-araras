import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createPaymentProvider } from "@/server/payments/provider";
import { z } from "zod";

const createPaymentInput = z.object({
  code: z.string(),
  title: z.string(),
  description: z.string(),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  buyer: z.object({
    name: z.string(),
    surname: z.string(),
    phone: z.string().min(10),
  }),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const paymentsRouter = createTRPCRouter({
  create: publicProcedure.input(createPaymentInput).mutation(async ({ input }) => {
    const provider = createPaymentProvider();

    const response = await provider.createPayment({
      code: input.code,
      title: input.title,
      description: input.description,
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      buyer: input.buyer,
      metadata: input.metadata,
    });

    return response;
  }),

  status: publicProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const provider = createPaymentProvider();
      const response = await provider.getPaymentStatus(input.reference);
      return response;
    }),
});

