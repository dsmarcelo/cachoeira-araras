import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { voucherSchema } from "@/lib/voucher/types";
import { z } from "zod";

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

  findById: publicProcedure
    .input(z.number().int())
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          id: input,
        },
      });
    }),

  findByCode: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          code: input,
        },
      });
    }),

  findByPhone: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          phone: input,
        },
      });
    }),

  findBy: publicProcedure.input(voucherSchema).query(async ({ ctx, input }) => {
    return await ctx.db.voucher.findFirst({
      where: {
        OR: [
          {
            name: input.name,
          },
          {
            phone: input.phone,
          },
          {
            code: input.code,
          },
        ],
      },
    });
  }),

  findValid: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: {
        valid: true,
      },
    });
  }),

  findInvalid: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: {
        valid: false,
      },
    });
  }),

  update: publicProcedure
    .input(voucherSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: input,
      });
    }),

  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return await ctx.db.voucher.delete({
      where: {
        code: input,
      },
    });
  }),
});
