import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
  staffProcedure,
} from "@/server/api/trpc";
import { voucherSchema } from "@/lib/voucher/types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAllSettings } from "@/lib/settings";
import { validateVoucherPurchase } from "@/server/voucher-purchase";
import { formatPaymentUrl } from "@/lib/utils";
import { searchMercadoPagoPaymentsByExternalReference } from "@/server/mercadopago";
import { confirmVoucherPaymentByCode } from "@/server/voucher";
import { startVoucherCheckout } from "@/server/voucher-purchase-intake";

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

const adminVoucherListInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
  search: z.string().trim().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  sortBy: z.enum(["id", "createdAt", "expires_at", "status", "name"]).default("id"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const adminVoucherSummaryInput = adminVoucherListInput.omit({
  page: true,
  pageSize: true,
  sortBy: true,
  sortDirection: true,
});

const adminSalesSummaryInput = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
});
const createVoucherInput = voucherSchema.extend({
  testMode: z.boolean().optional().default(false),
});

const startVoucherCheckoutInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatorio")
    .max(40, "Nome deve ser menor que 40 caracteres"),
  phone: z.string().trim().min(11),
  adults: z.number().int().min(0),
  elderly: z.number().int().min(0),
  adults_pool: z.number().int().min(0),
  elderly_pool: z.number().int().min(0),
  intendedDate: z.date(),
  testMode: z.boolean().optional().default(false),
  referrerUrl: z.string().max(2048).optional().nullable(),
});

function getEndOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getAdminVoucherWhere(input: z.infer<typeof adminVoucherSummaryInput>): Prisma.VoucherWhereInput {
  const search = input.search?.trim();

  return {
    deletedAt: null,
    ...(input.status && input.status !== "all"
      ? { status: input.status }
      : {}),
    ...(input.from !== undefined || input.to !== undefined
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: getEndOfDay(input.to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const voucherRouter = createTRPCRouter({
  startCheckout: publicProcedure
    .input(startVoucherCheckoutInput)
    .mutation(async ({ ctx, input }) => {
      return await startVoucherCheckout(input, {
        canUseTestMode:
          ctx.session?.user.role === "admin" ||
          ctx.session?.user.role === "employee",
      });
    }),

  create: publicProcedure
    .input(createVoucherInput)
    .mutation(async ({ ctx, input }) => {
      const { testMode, ...voucherData } = input;
      const settings = await getAllSettings();
      const validation = validateVoucherPurchase(
        {
          adults: input.adults,
          elderly: input.elderly,
          adults_pool: input.adults_pool,
          elderly_pool: input.elderly_pool,
          intendedDate: input.expires_at,
          testMode,
        },
        {
          canUseTestMode:
            ctx.session?.user.role === "admin" ||
            ctx.session?.user.role === "employee",
          settings,
        },
      );

      return await ctx.db.voucher.create({
        data: {
          ...voucherData,
          price: validation.price,
        },
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

  reconcilePublicPaymentStatus: publicProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .query(async ({ ctx, input }) => {
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
        },
        select: {
          code: true,
          payment_id: true,
          preference_id: true,
          status: true,
        },
      });

      if (!voucher) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Voucher não encontrado.",
        });
      }

      if (voucher.status !== "pending" && voucher.payment_id) {
        return {
          checkoutUrl: null,
          status: "paid" as const,
          successUrl: formatPaymentUrl(voucher.preference_id, voucher.payment_id),
        };
      }

      const payments =
        await searchMercadoPagoPaymentsByExternalReference(voucher.code);
      const approvedPayments = payments.filter(
        (payment) => payment.status === "approved",
      );

      if (approvedPayments.length === 0) {
        return {
          checkoutUrl: null,
          status: "pending" as const,
          successUrl: null,
        };
      }

      const [firstApprovedPayment, ...duplicateApprovedPayments] = approvedPayments;
      if (!firstApprovedPayment) {
        return {
          checkoutUrl: null,
          status: "pending" as const,
          successUrl: null,
        };
      }

      if (duplicateApprovedPayments.length > 0) {
        console.warn("Multiple approved payments found for voucher", {
          code: voucher.code,
          paymentIds: approvedPayments.map((payment) => payment.id),
        });
      }

      const result = await confirmVoucherPaymentByCode({
        code: voucher.code,
        paymentId: firstApprovedPayment.id,
        paymentStatus: "approved",
      });

      if (result.outcome === "not_found") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Voucher não encontrado.",
        });
      }

      return {
        checkoutUrl: null,
        status: "paid" as const,
        successUrl: formatPaymentUrl(
          result.voucher.preference_id,
          firstApprovedPayment.id,
        ),
      };
    }),

  findAdminPage: adminProcedure
    .input(adminVoucherListInput)
    .query(async ({ ctx, input }) => {
      const where = getAdminVoucherWhere(input);
      const skip = (input.page - 1) * input.pageSize;
      const orderBy: Prisma.VoucherOrderByWithRelationInput = {
        [input.sortBy]: input.sortDirection,
      };

      const [items, total] = await ctx.db.$transaction([
        ctx.db.voucher.findMany({
          where,
          orderBy,
          skip,
          take: input.pageSize,
        }),
        ctx.db.voucher.count({ where }),
      ]);

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.max(Math.ceil(total / input.pageSize), 1),
      };
    }),

  getAdminVoucherSummary: adminProcedure
    .input(adminVoucherSummaryInput)
    .query(async ({ ctx, input }) => {
      const vouchers = await ctx.db.voucher.findMany({
        where: getAdminVoucherWhere(input),
        select: {
          status: true,
          payment_id: true,
          price: true,
          adults: true,
          elderly: true,
          adults_pool: true,
          elderly_pool: true,
        },
      });

      const paidVouchers = vouchers.filter((voucher) => voucher.payment_id !== null);
      const totalSales = paidVouchers.reduce((total, voucher) => total + voucher.price, 0);
      const totalAdults = paidVouchers.reduce((total, voucher) => total + voucher.adults, 0);
      const totalElderly = paidVouchers.reduce((total, voucher) => total + voucher.elderly, 0);
      const totalAdultsPool = paidVouchers.reduce((total, voucher) => total + voucher.adults_pool, 0);
      const totalElderlyPool = paidVouchers.reduce((total, voucher) => total + voucher.elderly_pool, 0);

      return {
        total: vouchers.length,
        paidCount: paidVouchers.length,
        totalSales,
        totalAdults,
        totalElderly,
        totalAdultsPool,
        totalElderlyPool,
        visitorsCount: totalAdults + totalElderly + totalAdultsPool + totalElderlyPool,
        averageVoucherValue: paidVouchers.length > 0 ? totalSales / paidVouchers.length : 0,
        averagePeoplePerVoucher:
          paidVouchers.length > 0
            ? (totalAdults + totalElderly) / paidVouchers.length
            : 0,
        statusCounts: {
          valid: vouchers.filter((voucher) => voucher.status === "valid").length,
          pending: vouchers.filter((voucher) => voucher.status === "pending").length,
          redeemed: vouchers.filter(
            (voucher) => voucher.status === "redeemed" || voucher.status === "used",
          ).length,
          expired: vouchers.filter((voucher) => voucher.status === "expired").length,
        },
      };
    }),

  getAdminSalesSummary: adminProcedure
    .input(adminSalesSummaryInput)
    .query(async ({ ctx, input }) => {
      const vouchers = await ctx.db.voucher.findMany({
        where: {
          deletedAt: null,
          payment_id: { not: null },
          ...(input.from !== undefined || input.to !== undefined
            ? {
                createdAt: {
                  ...(input.from ? { gte: input.from } : {}),
                  ...(input.to ? { lte: getEndOfDay(input.to) } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          price: true,
          adults: true,
          elderly: true,
        },
      });

      const dailySales = vouchers.reduce(
        (acc, voucher) => {
          const day = voucher.createdAt.toISOString().slice(0, 10);
          acc[day] ??= {
            date: day,
            revenue: 0,
            vouchers: 0,
            visitors: 0,
            adults: 0,
            elderly: 0,
          };
          acc[day].revenue += voucher.price;
          acc[day].vouchers += 1;
          acc[day].visitors += voucher.adults + voucher.elderly;
          acc[day].adults += voucher.adults;
          acc[day].elderly += voucher.elderly;
          return acc;
        },
        {} as Record<
          string,
          {
            date: string;
            revenue: number;
            vouchers: number;
            visitors: number;
            adults: number;
            elderly: number;
          }
        >,
      );

      const totalRevenue = vouchers.reduce((total, voucher) => total + voucher.price, 0);
      const totalInteiras = vouchers.reduce((total, voucher) => total + voucher.adults, 0);
      const totalMeias = vouchers.reduce((total, voucher) => total + voucher.elderly, 0);

      return {
        totalRevenue,
        paidCount: vouchers.length,
        averageTicket: vouchers.length > 0 ? totalRevenue / vouchers.length : 0,
        totalInteiras,
        totalMeias,
        dailySalesData: Object.values(dailySales),
      };
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
