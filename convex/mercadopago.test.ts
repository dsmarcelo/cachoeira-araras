/// <reference types="vite/client" />
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import {
  getSaoPauloMonthRange,
  isLikelyPaymentId,
  isLikelyVoucherCode,
  normalizeSearch,
} from "./mercadopago";
import type {
  MercadoPagoPaymentListItem,
  MercadoPagoPaymentListResult,
  MercadoPagoRawPayment,
  SearchMercadoPagoPaymentsInput,
} from "./lib/mercadopago";
import { createConvexTest, withAuth } from "./test.setup";

const searchMercadoPagoPayments = vi.fn<
  (input: SearchMercadoPagoPaymentsInput) => Promise<MercadoPagoPaymentListResult>
>();
const getMercadoPagoPayment = vi.fn<
  (id: string) => Promise<MercadoPagoRawPayment | null>
>();

vi.mock("./lib/mercadopago", () => ({
  searchMercadoPagoPayments: (input: SearchMercadoPagoPaymentsInput) =>
    searchMercadoPagoPayments(input),
  getMercadoPagoPayment: (id: string) => getMercadoPagoPayment(id),
  mapMercadoPagoPayment: (payment: MercadoPagoRawPayment) => {
    if (!payment.id) return null;
    return {
      id: String(payment.id),
      status: payment.status ?? null,
      statusDetail: payment.status_detail ?? null,
      externalReference: payment.external_reference ?? null,
      dateCreated: payment.date_created ?? null,
      dateApproved: payment.date_approved ?? null,
      transactionAmount: payment.transaction_amount ?? null,
      currencyId: payment.currency_id ?? null,
      paymentMethodId: payment.payment_method_id ?? null,
      paymentTypeId: payment.payment_type_id ?? null,
      payerEmail: payment.payer?.email ?? null,
      payerName: payment.payer?.first_name ?? null,
      refundedAmount: payment.refunded_amount ?? null,
    };
  },
}));

beforeEach(() => {
  searchMercadoPagoPayments.mockReset();
  getMercadoPagoPayment.mockReset();
});

test("date and search helpers work as expected", () => {
  const range = getSaoPauloMonthRange("2025-03");
  expect(range.start.toISOString()).toBe("2025-03-01T03:00:00.000Z");
  expect(range.end.toISOString()).toBe("2025-04-01T02:59:59.999Z");

  expect(() => getSaoPauloMonthRange("invalid")).toThrow("Mês inválido.");
  expect(() => getSaoPauloMonthRange("2025-13")).toThrow("Mês inválido.");

  expect(normalizeSearch("  TEST  ")).toBe("test");
  expect(isLikelyPaymentId("1234567890")).toBe(true);
  expect(isLikelyPaymentId("abc")).toBe(false);
  expect(isLikelyVoucherCode("VOUCH1")).toBe(true);
  expect(isLikelyVoucherCode("longerthan8chars")).toBe(false);
});

test("listAdminPaymentsByMonth requires admin role", async () => {
  const t = createConvexTest();

  // Anonymous caller
  await expect(
    t.action(api.mercadopago.listAdminPaymentsByMonth, { month: "2025-03" }),
  ).rejects.toThrow();

  // Employee caller
  const asEmployee = await withAuth(t, "employee");
  await expect(
    asEmployee.action(api.mercadopago.listAdminPaymentsByMonth, {
      month: "2025-03",
    }),
  ).rejects.toThrow();
});

test("listAdminPaymentsByMonth enriches payments with Convex voucher data", async () => {
  const t = createConvexTest();

  // Insert a voucher in Convex database
  await t.run(async (ctx) => {
    await ctx.db.insert("vouchers", {
      code: "V123",
      name: "João Silva",
      phone: "11999999999",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: "valid",
      visitDate: "2025-03-15",
      expiresAt: Date.now() + 100000,
      preferenceId: "pref-1",
      paymentId: "pay-456",
      isTest: false,
    });
  });

  const mpPayments: MercadoPagoPaymentListItem[] = [
    {
      id: "pay-111",
      status: "approved",
      statusDetail: "accredited",
      externalReference: "V123",
      dateCreated: "2025-03-15T10:00:00.000Z",
      dateApproved: "2025-03-15T10:05:00.000Z",
      transactionAmount: 50,
      currencyId: "BRL",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      payerEmail: "joao@example.com",
      payerName: "João",
      refundedAmount: 0,
    },
    {
      id: "pay-456",
      status: "approved",
      statusDetail: "accredited",
      externalReference: null,
      dateCreated: "2025-03-15T11:00:00.000Z",
      dateApproved: "2025-03-15T11:05:00.000Z",
      transactionAmount: 50,
      currencyId: "BRL",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      payerEmail: "joao2@example.com",
      payerName: "João",
      refundedAmount: 0,
    },
    {
      id: "pay-999",
      status: "approved",
      statusDetail: "accredited",
      externalReference: "OTHER",
      dateCreated: "2025-03-15T12:00:00.000Z",
      dateApproved: "2025-03-15T12:05:00.000Z",
      transactionAmount: 50,
      currencyId: "BRL",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      payerEmail: "stranger@example.com",
      payerName: "Stranger",
      refundedAmount: 0,
    },
  ];

  searchMercadoPagoPayments.mockResolvedValueOnce({
    items: mpPayments,
    total: 3,
  });

  const asAdmin = await withAuth(t, "admin");
  const result = await asAdmin.action(
    api.mercadopago.listAdminPaymentsByMonth,
    { month: "2025-03" },
  );

  expect(result.items).toHaveLength(3);

  // Matched by external reference (code)
  expect(result.items[0]).toMatchObject({
    paymentId: "pay-111",
    voucherCode: "V123",
    voucherBuyerName: "João Silva",
    matchSource: "external_reference",
  });

  // Matched by paymentId
  expect(result.items[1]).toMatchObject({
    paymentId: "pay-456",
    voucherCode: "V123",
    voucherBuyerName: "João Silva",
    matchSource: "payment_id",
  });

  // Unmatched
  expect(result.items[2]).toMatchObject({
    paymentId: "pay-999",
    voucherCode: "OTHER",
    voucherBuyerName: null,
    matchSource: "unmatched",
  });
});

test("getAdminPaymentsMonthSummary requires admin and calculates totals", async () => {
  const t = createConvexTest();

  // Anonymous
  await expect(
    t.action(api.mercadopago.getAdminPaymentsMonthSummary, {
      month: "2025-03",
    }),
  ).rejects.toThrow();

  searchMercadoPagoPayments.mockResolvedValueOnce({
    items: [
      {
        id: "1",
        status: "approved",
        statusDetail: "accredited",
        externalReference: "A",
        dateCreated: "2025-03-01T10:00:00.000Z",
        dateApproved: "2025-03-01T10:00:00.000Z",
        transactionAmount: 100,
        currencyId: "BRL",
        paymentMethodId: "pix",
        paymentTypeId: "bank_transfer",
        payerEmail: null,
        payerName: null,
        refundedAmount: 0,
      },
      {
        id: "2",
        status: "approved",
        statusDetail: "accredited",
        externalReference: "B",
        dateCreated: "2025-03-02T10:00:00.000Z",
        dateApproved: "2025-03-02T10:00:00.000Z",
        transactionAmount: 150,
        currencyId: "BRL",
        paymentMethodId: "pix",
        paymentTypeId: "bank_transfer",
        payerEmail: null,
        payerName: null,
        refundedAmount: 0,
      },
    ],
    total: 2,
  });

  const asAdmin = await withAuth(t, "admin");
  const summary = await asAdmin.action(
    api.mercadopago.getAdminPaymentsMonthSummary,
    { month: "2025-03" },
  );

  expect(summary).toEqual({
    approvedAmount: 250,
    approvedCount: 2,
    incomplete: false,
    scanLimit: 2000,
  });
});
