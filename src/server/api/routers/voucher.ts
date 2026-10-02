import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
  staffProcedure,
} from "@/server/api/trpc";
import { voucherSchema } from "@/lib/voucher/types";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getAllSettings } from "@/lib/settings";
import { validateVoucherPurchase } from "@/server/voucher-purchase";
import { formatPaymentUrl } from "@/lib/utils";
import { getMercadoPagoPayment } from "@/server/mercadopago";
import { syncVoucherPayment, syncDisplayedVouchers } from "@/server/voucher-payment-sync";
import { startVoucherCheckout } from "@/server/voucher-purchase-intake";
import { brazilDateKeyToDate } from "@/server/voucher-expiry";
import { planVisitDateUpdate } from "@/server/voucher-visit-date";

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
  search: z.string().trim().max(100).optional(),
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

const todayPageInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.string().optional(),
});

async function getTodayPage(db: PrismaClient, input: z.infer<typeof todayPageInput>) {
  const where: Prisma.VoucherWhereInput = {
    AND: [getTodayVoucherWhere(), getAdminVoucherWhere({ search: input.search, status: input.status })],
  };
  const [items, total] = await db.$transaction([
    db.voucher.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    db.voucher.count({ where }),
  ]);
  const synced = await syncDisplayedVouchers(items);
  const updatedCount = items.length - synced.items.length + synced.items.filter((item) => item.status !== items.find((original) => original.id === item.id)?.status).length;
  const refreshedTotal = updatedCount ? await db.voucher.count({ where }) : total;
  return { ...synced,
    items: synced.items.filter((item) => !item.deletedAt && ["pending", "valid"].includes(item.status) &&
      (!input.status || input.status === "all" || item.status === input.status)),
    updatedCount, total: refreshedTotal, page: input.page, pageSize: input.pageSize,
    pageCount: Math.max(Math.ceil(refreshedTotal / input.pageSize), 1),
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
        where: { code: input.code, deletedAt: null },
      });
      if (!voucher) throw new TRPCError({ code: "NOT_FOUND", message: "Voucher não encontrado." });
      const result = await syncVoucherPayment(voucher, undefined, true);
      const paid = result.voucher.status !== "pending" && result.voucher.payment_id;
      return {
        checkoutUrl: null,
        status: paid ? "paid" as const : "pending" as const,
        successUrl: paid && result.voucher.payment_id
          ? formatPaymentUrl(result.voucher.preference_id, result.voucher.payment_id)
          : null,
        syncWarning: result.syncError ? "Não foi possível atualizar o pagamento. Tente novamente." : null,
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
          orderBy: [orderBy, { id: input.sortDirection }],
          skip,
          take: input.pageSize,
        }),
        ctx.db.voucher.count({ where }),
      ]);

      const synced = await syncDisplayedVouchers(items);
      const updatedCount = items.length - synced.items.length + synced.items.filter((item) => item.status !== items.find((original) => original.id === item.id)?.status).length;
      // Recount after recovery without loading/reconciling a replacement page.
      const refreshedTotal = updatedCount ? await ctx.db.voucher.count({ where }) : total;
      return {
        ...synced,
        items: synced.items.filter((item) => !item.deletedAt && (!input.status || input.status === "all" || item.status === input.status)),
        updatedCount,
        total: refreshedTotal,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.max(Math.ceil(refreshedTotal / input.pageSize), 1),
      };
    }),

  getAdminVoucherSummary: adminProcedure
    .input(adminVoucherSummaryInput)
    .query(async ({ ctx, input }) => {
      const where = getAdminVoucherWhere(input);
      const [total, paid, grouped] = await Promise.all([
        ctx.db.voucher.count({ where }),
        ctx.db.voucher.aggregate({
          where: { AND: [where, { payment_id: { not: null }, status: { not: "pending" } }] },
          _count: true,
          _sum: { price: true, adults: true, elderly: true, adults_pool: true, elderly_pool: true },
        }),
        ctx.db.voucher.groupBy({ by: ["status"], where, _count: true }),
      ]);
      const totalAdults = paid._sum.adults ?? 0;
      const totalElderly = paid._sum.elderly ?? 0;
      const totalAdultsPool = paid._sum.adults_pool ?? 0;
      const totalElderlyPool = paid._sum.elderly_pool ?? 0;
      const totalSales = paid._sum.price ?? 0;
      const countStatus = (...statuses: string[]) => grouped.reduce(
        (sum, group) => sum + (statuses.includes(group.status) ? group._count : 0), 0,
      );
      return {
        total, paidCount: paid._count, totalSales, totalAdults, totalElderly,
        totalAdultsPool, totalElderlyPool,
        visitorsCount: totalAdults + totalElderly + totalAdultsPool + totalElderlyPool,
        averageVoucherValue: paid._count ? totalSales / paid._count : 0,
        averagePeoplePerVoucher: paid._count ? (totalAdults + totalElderly) / paid._count : 0,
        statusCounts: {
          valid: countStatus("valid"), pending: countStatus("pending"),
          redeemed: countStatus("redeemed", "used"), expired: countStatus("expired"),
        },
      };
    }),

  getAdminSalesSummary: adminProcedure
    .input(adminSalesSummaryInput)
    .query(async ({ ctx, input }) => {
      // PostgreSQL aggregates by UTC day, matching the previous toISOString()
      // grouping without materializing every paid voucher in application memory.
      const dailySalesData = await ctx.db.$queryRaw<Array<{
        date: string; revenue: number; vouchers: number; visitors: number;
        adults: number; elderly: number;
      }>>(Prisma.sql`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS date,
          SUM(price)::double precision AS revenue,
          COUNT(*)::integer AS vouchers,
          SUM(adults + elderly)::integer AS visitors,
          SUM(adults)::integer AS adults,
          SUM(elderly)::integer AS elderly
        FROM "Voucher"
        WHERE "deletedAt" IS NULL AND payment_id IS NOT NULL AND status <> 'pending'
          ${input.from ? Prisma.sql`AND "createdAt" >= ${input.from}` : Prisma.empty}
          ${input.to ? Prisma.sql`AND "createdAt" <= ${getEndOfDay(input.to)}` : Prisma.empty}
        GROUP BY to_char("createdAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `);
      const totalRevenue = dailySalesData.reduce((sum, day) => sum + day.revenue, 0);
      const paidCount = dailySalesData.reduce((sum, day) => sum + day.vouchers, 0);
      return {
        totalRevenue, paidCount,
        averageTicket: paidCount ? totalRevenue / paidCount : 0,
        totalInteiras: dailySalesData.reduce((sum, day) => sum + day.adults, 0),
        totalMeias: dailySalesData.reduce((sum, day) => sum + day.elderly, 0),
        dailySalesData,
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

  getAdminDetails: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const voucher = await ctx.db.voucher.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!voucher) throw new TRPCError({ code: "NOT_FOUND", message: "Voucher não encontrado." });
    const result = await syncVoucherPayment(voucher, undefined, true);
    if (result.voucher.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Voucher não encontrado." });
    let payment = result.payment;
    let paymentError = false;
    if (!payment && result.voucher.payment_id) {
      payment = await getMercadoPagoPayment(result.voucher.payment_id).catch(() => {
        paymentError = true;
        return null;
      });
    }
    return {
      voucher: result.voucher, payment,
      updated: result.voucher.status !== voucher.status,
      syncWarning: result.syncError || paymentError
        ? "Não foi possível atualizar o pagamento. Tente novamente em instantes." : null,
    };
  }),

  findById: adminProcedure
    .input(z.number().int())
    .query(async ({ ctx, input }) => {
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          id: input,
        },
      });
      return voucher ? (await syncVoucherPayment(voucher, undefined, true)).voucher : null;
    }),

  findByCode: staffProcedure
    .input(z.object({ code: z.string().min(3).max(4) }))
    .query(async ({ ctx, input }) => {
      const voucher = await ctx.db.voucher.findFirst({
        where: {
          code: input.code,
          deletedAt: null,
        },
      });
      if (!voucher) return null;
      const result = await syncVoucherPayment(voucher, undefined, true);
      return { ...result.voucher, syncWarning: result.syncError
        ? "Não foi possível atualizar o pagamento. Tente novamente em instantes." : null };

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

  getTodayPage: adminProcedure.input(todayPageInput).query(({ ctx, input }) => getTodayPage(ctx.db, input)),

  getTodayOperationalPage: staffProcedure.input(todayPageInput).query(async ({ ctx, input }) => {
    const result = await getTodayPage(ctx.db, input);
    return {
      ...result,
      items: result.items.map(({ id, name, phone, code, adults, elderly, adults_pool, elderly_pool,
        valid, status, expires_at, createdAt, updatedAt }) => ({
        id, name, phone, code, adults, elderly, adults_pool, elderly_pool,
        valid, status, expires_at, createdAt, updatedAt,
      })),
    };
  }),

  getTodaySummary: adminProcedure.query(async ({ ctx }) => {
    const where = { ...getTodayVoucherWhere(), status: "valid", valid: true, payment_id: { not: null } };
    const result = await ctx.db.voucher.aggregate({
      where, _count: true, _sum: { price: true, adults: true, elderly: true },
    });
    return {
      paidCount: result._count, totalSales: result._sum.price ?? 0,
      totalAdults: result._sum.adults ?? 0, totalElderly: result._sum.elderly ?? 0,
      visitorsCount: (result._sum.adults ?? 0) + (result._sum.elderly ?? 0),
    };
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

  /** Admin-only: moves the visit day; reactivates expired vouchers moved to today or later. */
  updateVisitDate: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        // "YYYY-MM-DD" day in Brasília, so browser and server time zones never matter.
        date: z.string().transform((key, ctx) => {
          const date = brazilDateKeyToDate(key);
          if (!date) {
            ctx.addIssue({ code: "custom", message: "Data inválida." });
            return z.NEVER;
          }
          return date;
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const voucher = await ctx.db.voucher.findFirst({
        where: { id: input.id, deletedAt: null },
        select: { status: true },
      });
      if (!voucher) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Voucher não encontrado." });
      }
      const plan = planVisitDateUpdate(voucher, input.date);
      if (!plan.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: plan.message });
      }
      return await ctx.db.voucher.update({
        where: { id: input.id },
        data: plan.data,
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
