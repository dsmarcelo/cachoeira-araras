import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";
import {
  getMercadoPagoPayment,
  mapMercadoPagoPayment,
  searchMercadoPagoPayments,
  type MercadoPagoPaymentListItem,
} from "./lib/mercadopago";

export const summaryScanLimit = 2000;
export const summaryPageSize = 50;

export function getSaoPauloMonthRange(month: string): {
  start: Date;
  end: Date;
} {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new Error("Mês inválido.");
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 3, 0, 0, 0));
  const nextMonthStart = new Date(
    Date.UTC(year, monthIndex + 1, 1, 3, 0, 0, 0),
  );
  const end = new Date(nextMonthStart.getTime() - 1);

  return { start, end };
}

export function isPaymentInsideRange(
  payment: MercadoPagoPaymentListItem,
  start: Date,
  end: Date,
): boolean {
  if (!payment.dateCreated) {
    return false;
  }

  const createdTime = new Date(payment.dateCreated).getTime();
  return (
    !Number.isNaN(createdTime) &&
    createdTime >= start.getTime() &&
    createdTime <= end.getTime()
  );
}

export function paymentMatchesStatus(
  payment: MercadoPagoPaymentListItem,
  status: string,
): boolean {
  if (!status || status === "all") {
    return true;
  }

  return payment.status === status;
}

export function normalizeSearch(search: string | undefined): string {
  return search?.trim().toLowerCase() ?? "";
}

export function isLikelyPaymentId(search: string): boolean {
  return /^\d{8,16}$/.test(search);
}

export function isLikelyVoucherCode(search: string): boolean {
  return /^[A-Z0-9]{4,8}$/i.test(search);
}

export type EnrichedPayment = MercadoPagoPaymentListItem & {
  paymentId: string;
  voucherCode: string | null;
  voucherBuyerName: string | null;
  voucherBuyerPhone: string | null;
  voucherStatus: string | null;
  matchSource: "external_reference" | "payment_id" | "unmatched";
};

export function paymentMatchesBroadSearch(
  payment: EnrichedPayment,
  search: string,
): boolean {
  if (!search) {
    return true;
  }

  const searchValues = [
    payment.paymentId,
    payment.voucherCode,
    payment.payerName,
    payment.payerEmail,
    payment.voucherBuyerName,
    payment.voucherBuyerPhone,
  ];

  return searchValues.some((value) =>
    value ? value.toLowerCase().includes(search) : false,
  );
}

export async function enrichPaymentsWithVoucherData(
  payments: MercadoPagoPaymentListItem[],
  ctx: ActionCtx,
): Promise<EnrichedPayment[]> {
  if (payments.length === 0) {
    return [];
  }

  const externalReferences = payments
    .map((payment) => payment.externalReference)
    .filter((code): code is string => Boolean(code));
  const paymentIds = payments.map((payment) => payment.id);

  const vouchers = await ctx.runQuery(
    internal.vouchers.findForPaymentEnrichment,
    {
      codes: externalReferences,
      paymentIds,
    },
  );

  const byCode = new Map<string, (typeof vouchers)[number]>();
  const byPaymentId = new Map<string, (typeof vouchers)[number]>();

  vouchers.forEach((voucher) => {
    byCode.set(voucher.code, voucher);
    if (voucher.paymentId) {
      byPaymentId.set(voucher.paymentId, voucher);
    }
  });

  return payments.map((payment) => {
    const voucherByCode = payment.externalReference
      ? byCode.get(payment.externalReference)
      : undefined;
    const voucherByPaymentId = byPaymentId.get(payment.id);
    const voucher = voucherByCode ?? voucherByPaymentId;
    const matchSource = voucherByCode
      ? ("external_reference" as const)
      : voucherByPaymentId
        ? ("payment_id" as const)
        : ("unmatched" as const);

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

export const listAdminPaymentsByMonth = action({
  args: {
    month: v.string(),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    await requireRole(ctx, "admin");

    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      throw new Error("Mês inválido.");
    }

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;
    const status = input.status ?? "approved";
    const { start, end } = getSaoPauloMonthRange(input.month);
    const search = normalizeSearch(input.search);
    const offset = (page - 1) * pageSize;

    if (isLikelyPaymentId(search)) {
      const payment = await getMercadoPagoPayment(search);
      const normalizedPayment = payment ? mapMercadoPagoPayment(payment) : null;
      const matches =
        normalizedPayment &&
        isPaymentInsideRange(normalizedPayment, start, end) &&
        paymentMatchesStatus(normalizedPayment, status)
          ? [normalizedPayment]
          : [];
      const enriched = await enrichPaymentsWithVoucherData(matches, ctx);

      return {
        items: enriched,
        page,
        pageCount: enriched.length > 0 ? 1 : 0,
        pageSize,
        searchMode: "exact_payment_id" as const,
        total: enriched.length,
      };
    }

    const result = await searchMercadoPagoPayments({
      beginDate: start,
      endDate: end,
      externalReference: isLikelyVoucherCode(search) ? search : undefined,
      limit: pageSize,
      offset,
      status,
    });
    const enriched = await enrichPaymentsWithVoucherData(result.items, ctx);
    const filtered = isLikelyVoucherCode(search)
      ? enriched
      : enriched.filter((payment) => paymentMatchesBroadSearch(payment, search));
    const broadSearchActive = Boolean(search) && !isLikelyVoucherCode(search);
    const total = broadSearchActive ? filtered.length : result.total;

    return {
      items: filtered,
      page,
      pageCount: Math.ceil(total / pageSize),
      pageSize,
      searchMode: broadSearchActive
        ? ("current_page" as const)
        : ("mercado_pago" as const),
      total,
    };
  },
});

export const getAdminPaymentsMonthSummary = action({
  args: {
    month: v.string(),
  },
  handler: async (ctx, input) => {
    await requireRole(ctx, "admin");

    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      throw new Error("Mês inválido.");
    }

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
  },
});
