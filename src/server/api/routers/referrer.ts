import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { referrerSchema } from "@/lib/voucher/types";
import { z } from "zod";

const referrerEnum = z.enum(["facebook", "google", "instagram", "gmail"]);

export const referrerRouter = createTRPCRouter({
  create: publicProcedure
    .input(referrerSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.referrer.create({
        data: {
          voucherCode: input.voucherCode, // Ensure this matches the voucherCode in the Voucher model
          referrer: input.referrer,
          url: input.url,
        },
      });
    }),
  findAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.referrer.findMany();
  }),
  findByCode: publicProcedure
    .input(z.string().min(3).max(4))
    .query(async ({ ctx, input }) => {
      return await ctx.db.referrer.findFirst({
        where: {
          voucherCode: input,
        },
      });
    }),
  findByReferrer: publicProcedure
    .input(referrerEnum)
    .query(async ({ ctx, input }) => {
      return await ctx.db.referrer.findMany({
        where: {
          referrer: input,
        },
      });
    }),
});
