import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
  staffProcedure,
} from "@/server/api/trpc";
import { voucherSchema } from "@/lib/voucher/types";
import { z } from "zod";

function getTodayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return { today, tomorrow };
}

function getTodayVoucherWhere() {
  const { today, tomorrow } = getTodayRange();

  return {
    deletedAt: null,
    expires_at: {
      gte: today,
      lt: tomorrow,
    },
    status: {
      in: ["valid", "pending"],
    },
  };
}

export const voucherRouter = createTRPCRouter({
  create: publicProcedure
    .input(voucherSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.create({
        data: input,
      });
    }),

  getPublicStatusByCode: publicProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
        },
        select: {
          payment_id: true,
          preference_id: true,
          status: true,
        },
      });
    }),

  findAll: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: {
        deletedAt: null,
      },
    });
  }),

  findAllDeleted: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
    });
  }),

  findAllEvenDeleted: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany();
  }),

  findById: adminProcedure
    .input(z.number().int())
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          id: input,
        },
      });
    }),

  findByCode: staffProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
        },
      });
    }),

  redeemByCode: staffProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
        },
      });

      if (!voucher) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Voucher não encontrado.",
        });
      }

      if (!voucher.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este voucher não está disponível para uso.",
        });
      }

      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: {
          status: "redeemed",
          valid: false,
        },
      });
    }),

  findByPhone: adminProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          phone: input,
        },
      });
    }),

  findBy: adminProcedure
    .input(voucherSchema)
    .query(async ({ ctx, input }) => {
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

  findValid: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: {
        status: "valid",
      },
    });
  }),

  findByStatus: adminProcedure
    .input(voucherSchema)
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findMany({
        where: {
          status: input.status,
        },
      });
    }),

  findByPreferenceId: adminProcedure
    .input(z.object({ preference_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.voucher.findFirst({
        where: {
          preference_id: input.preference_id,
        },
      });
    }),

  getTodayVouchers: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: getTodayVoucherWhere(),
      orderBy: {
        status: "asc",
      },
    });
  }),

  getTodayOperationalVouchers: staffProcedure.query(async ({ ctx }) => {
    return await ctx.db.voucher.findMany({
      where: getTodayVoucherWhere(),
      orderBy: [
        {
          status: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        phone: true,
        code: true,
        adults: true,
        elderly: true,
        adults_pool: true,
        elderly_pool: true,
        valid: true,
        status: true,
        expires_at: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  update: adminProcedure
    .input(
      z.object({
        where: z.object({
          code: z.string().optional(),
          id: z.number().optional(),
        }),
        data: voucherSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.where || Object.keys(input.where).length === 0) {
        throw new Error("The 'where' object cannot be empty");
      }

      const whereClause = input.where.code
        ? { code: input.where.code }
        : { id: input.where.id };

      return await ctx.db.voucher.update({
        where: whereClause,
        data: input.data,
      });
    }),

  updateVoucherStatus: adminProcedure
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

  redeemTodayVoucher: staffProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .mutation(async ({ ctx, input }) => {
      const { today, tomorrow } = getTodayRange();
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
          expires_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!voucher) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Voucher fora do fluxo operacional de hoje.",
        });
      }

      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: {
          status: "redeemed",
          valid: false,
        },
      });
    }),

  activateTodayVoucher: staffProcedure
    .input(
      z.object({
        code: z.string().min(3).max(4),
        refreshExpiry: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { today, tomorrow } = getTodayRange();
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
          expires_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!voucher) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Voucher fora do fluxo operacional de hoje.",
        });
      }

      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: {
          status: "valid",
          valid: true,
          ...(input.refreshExpiry && {
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31),
          }),
        },
      });
    }),

  updateByPreference_id: adminProcedure
    .input(
      z.object({
        preference_id: z.string(),
        data: voucherSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.update({
        where: {
          preference_id: input.preference_id,
        },
        data: input.data,
      });
    }),

  hardDelete: adminProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.delete({
        where: {
          code: input.code,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.voucher.update({
        where: {
          code: input.code,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }),
});
