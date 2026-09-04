import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import {
  getMercadoPagoPayment,
  mapMercadoPagoPayment,
  searchMercadoPagoPayments,
  type MercadoPagoPaymentListItem,
} from "@/server/mercadopago";

const paymentStatusSchema = z.enum([
  "all",
  "approved",
  "pending",
  "in_process",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const summaryScanLimit = 2000;
const summaryPageSize = 50;

type VoucherPaymentMatch = {
  code: string;
  name: string;
  phone: string;
  payment_id: string | null;
  status: string;
};

function getSaoPauloMonthRange(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mês inválido." });
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 3, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1, 3, 0, 0, 0));
  const end = new Date(nextMonthStart.getTime() - 1);

  return { start, end };
}

function isPaymentInsideRange(
  payment: MercadoPagoPaymentListItem,
  start: Date,
  end: Date,
) {
  if (!payment.dateCreated) return false;
  const dateCreated = new Date(payment.dateCreated);
  return dateCreated >= start && dateCreated <= end;
}

function paymentMatchesStatus(payment: MercadoPagoPaymentListItem, status: string) {
  return status === "all" || payment.status === status;
}

function normalizeSearch(search: string | undefined) {
  return search?.trim() ?? "";
}

function isLikelyPaymentId(search: string) {
  return /^\d{6,}$/.test(search);
}

function isLikelyVoucherCode(search: string) {
  return /^[a-z0-9]{3,8}$/i.test(search) && !isLikelyPaymentId(search);
}

function paymentMatchesBroadSearch(
  payment: EnrichedPayment,
  search: string,
): boolean {
  if (!search) return true;
  const normalizedSearch = search.toLowerCase();
  const values = [
    payment.paymentId,
    payment.voucherCode,
    payment.payerName,
    payment.payerEmail,
    payment.voucherBuyerName,
    payment.voucherBuyerPhone,
  ];

  return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
}

type EnrichedPayment = MercadoPagoPaymentListItem & {
  paymentId: string;
  voucherCode: string | null;
  voucherBuyerName: string | null;
  voucherBuyerPhone: string | null;
  voucherStatus: string | null;
  matchSource: "external_reference" | "payment_id" | "unmatched";
};

async function enrichPaymentsWithVoucherData(
  payments: MercadoPagoPaymentListItem[],
  ctx: { db: PrismaClient },
): Promise<EnrichedPayment[]> {
  if (payments.length === 0) {
    return [];
  }
  const externalReferences = payments
    .map((payment) => payment.externalReference)
    .filter((code): code is string => Boolean(code));
  const paymentIds = payments.map((payment) => payment.id);

  const vouchers = await ctx.db.voucher.findMany({
    where: {
      OR: [
        externalReferences.length > 0 ? { code: { in: externalReferences } } : undefined,
        paymentIds.length > 0 ? { payment_id: { in: paymentIds } } : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition)),
    },
    select: {
      code: true,
      name: true,
      payment_id: true,
      phone: true,
      status: true,
    },
  });

  const byCode = new Map<string, VoucherPaymentMatch>();
  const byPaymentId = new Map<string, VoucherPaymentMatch>();

  vouchers.forEach((voucher) => {
    byCode.set(voucher.code, voucher);
    if (voucher.payment_id) {
      byPaymentId.set(voucher.payment_id, voucher);
    }
  });

  return payments.map((payment) => {
    const voucherByCode = payment.externalReference
      ? byCode.get(payment.externalReference)
      : undefined;
    const voucherByPaymentId = byPaymentId.get(payment.id);
    const voucher = voucherByCode ?? voucherByPaymentId;
    const matchSource = voucherByCode
      ? "external_reference"
      : voucherByPaymentId
        ? "payment_id"
        : "unmatched";

    return {
      ...payment,
      paymentId: payment.id,
      voucherCode: payment.externalReference ?? voucher?.code ?? null,
      voucherBuyerName: voucher?.name ?? null,
      voucherBuyerPhone: voucher?.phone ?? null,
      voucherStatus: voucher?.status ?? null,
      matchSource,
    };
  });
}

export const mercadopagoRouter = createTRPCRouter({
  listAdminPaymentsByMonth: adminProcedure
    .input(
      z.object({
        month: monthSchema,
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(25),
        search: z.string().max(120).optional(),
        status: paymentStatusSchema.default("approved"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getSaoPauloMonthRange(input.month);
      const search = normalizeSearch(input.search);
      const offset = (input.page - 1) * input.pageSize;

      if (isLikelyPaymentId(search)) {
        const payment = await getMercadoPagoPayment(search);
        const normalizedPayment = payment
          ? mapMercadoPagoPayment(payment)
          : null;
        const matches =
          normalizedPayment &&
          isPaymentInsideRange(normalizedPayment, start, end) &&
          paymentMatchesStatus(normalizedPayment, input.status)
            ? [normalizedPayment]
            : [];
        const enriched = await enrichPaymentsWithVoucherData(matches, ctx);

        return {
          items: enriched,
          page: input.page,
          pageCount: enriched.length > 0 ? 1 : 0,
          pageSize: input.pageSize,
          searchMode: "exact_payment_id" as const,
          total: enriched.length,
        };
      }

      const result = await searchMercadoPagoPayments({
        beginDate: start,
        endDate: end,
        externalReference: isLikelyVoucherCode(search) ? search : undefined,
        limit: input.pageSize,
        offset,
        status: input.status,
      });
      const enriched = await enrichPaymentsWithVoucherData(result.items, ctx);
      const filtered = isLikelyVoucherCode(search)
        ? enriched
        : enriched.filter((payment) => paymentMatchesBroadSearch(payment, search));
      const broadSearchActive = Boolean(search) && !isLikelyVoucherCode(search);
      const total = broadSearchActive ? filtered.length : result.total;

      return {
        items: filtered,
        page: input.page,
        pageCount: Math.ceil(total / input.pageSize),
        pageSize: input.pageSize,
        searchMode: broadSearchActive ? ("current_page" as const) : ("mercado_pago" as const),
        total,
      };
    }),

  getAdminPaymentsMonthSummary: adminProcedure
    .input(z.object({ month: monthSchema }))
    .query(async ({ input }) => {
      const { start, end } = getSaoPauloMonthRange(input.month);
      let offset = 0;
      let approvedCount = 0;
      let approvedAmount = 0;
      let mercadoPagoTotal: number | null = null;

      while (offset < summaryScanLimit) {
        const result = await searchMercadoPagoPayments({
          beginDate: start,
          endDate: end,
          limit: summaryPageSize,
          offset,
          status: "approved",
        });

        mercadoPagoTotal ??= result.total;
        approvedCount += result.items.length;
        approvedAmount += result.items.reduce(
          (sum, payment) => sum + (payment.transactionAmount ?? 0),
          0,
        );

        offset += summaryPageSize;

        if (result.items.length < summaryPageSize || offset >= result.total) {
          break;
        }
      }

      return {
        approvedAmount,
        approvedCount,
        incomplete: (mercadoPagoTotal ?? 0) > summaryScanLimit,
        scanLimit: summaryScanLimit,
      };
    }),

  getPreference: adminProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
        },
      });

      if (!res.ok) {
        return undefined;
      }
      const data = (await res.json()) as PreferenceResponse;
      return data;
    }),
  getPreferenceByEReference: adminProcedure
    .input(z.object({ external_reference: z.string().max(4) }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/checkout/preferences/search?external_reference=${input.external_reference}`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
          },
        });

        if (!res.ok) {
          return undefined;
        }
        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching Preference:", error);
        throw new Error("Failed to fetch Preference");
      }
    }),
  getPayment: adminProcedure
    .input(z.object({ payment_id: z.string() }))
    .query<PaymentResponse | undefined>(async ({ input }) => {
      const url = `https://api.mercadopago.com/v1/payments/${input.payment_id}`;
      // try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`,
        },
      });

      if (!res.ok) {
        return undefined;
      }
      const data: PaymentResponse = (await res.json()) as PaymentResponse;
      return data;
      // } catch (error) {
      //   console.error("Error fetching payment:", error);
      //   throw new Error("Failed to fetch payment");
      // }
    }),
});
