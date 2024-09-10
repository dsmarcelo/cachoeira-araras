import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

//TODO: notify when voucher is bought?
//TODO: notify when voucher is used?

export const notificationRouter = createTRPCRouter({
  bought: publicProcedure
    .input(
      z.object({
        code: z.string(),
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
      console.log("Notification bought", input);
      return { success: true };
    }),
});
