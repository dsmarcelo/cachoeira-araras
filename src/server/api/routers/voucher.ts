import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { voucherSchema } from "@/lib/voucher/types";

export const voucherRouter = createTRPCRouter({
  create: publicProcedure
    .input(voucherSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.create({
        data: input,
      });
    }),
  findAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany();
  }),
});
