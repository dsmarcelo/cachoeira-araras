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
    .input(z.object({ code: z.string().min(3).max(4) }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
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
        status: "valid",
      },
    });
  }),

  findByStatus: publicProcedure
    .input(voucherSchema)
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findMany({
        where: {
          status: input.status,
        },
      });
    }),

  updateVoucherStatus: publicProcedure
    .input(
      z.object({
        code: z.string(),
        data: z.object({
          status: z.string(),
          valid: z.boolean(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("🚀 ~ code:", input.code);
      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: {
          status: input.data.status,
          valid: input.data.valid,
        },
      });
    }),

  updateByPreference_id: publicProcedure
    .input(
      z.object({
        preference_id: z.string(),
        status: z.enum(["pending", "valid", "redeemed", "expired"]),
        valid: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.update({
        where: {
          preference_id: input.preference_id,
        },
        data: {
          status: input.status,
          valid: input.valid,
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.delete({
        where: {
          code: input.code,
        },
      });
    }),
});
