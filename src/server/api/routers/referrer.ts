import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { referrerSchema } from "@/lib/voucher/types";

export const referrerRouter = createTRPCRouter({
  create: publicProcedure
    .input(referrerSchema)
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return await ctx.db.referrer.create({
        data: {
          voucherCode: input.voucherCode, // Ensure this matches the voucherCode in the Voucher model
          referrer: input.referrer,
          url: input.url,
        },
      });
    }),
});
