import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type Voucher } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface VoucherWithPaymentDetails extends Voucher {
  paymentDetails: {
    method_id: string;
    method_name: string;
    payment_method_id?: string;
    card_brand?: string;
    installments?: number;
  };
}

export const paymentRouter = createTRPCRouter({
  // Obter todos os vouchers com dados de pagamento
  getPaymentMethods: publicProcedure
    .input(
      z
        .object({
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }): Promise<VoucherWithPaymentDetails[]> => {
      // Primeiro, obtemos todos os vouchers que têm payment_id
      const vouchers = (await ctx.db.voucher.findMany({
        where: {
          payment_id: {
            not: null,
          },
          createdAt: {
            // Aplica filtro de data se fornecido
            ...(input?.dateFrom && { gte: input.dateFrom }),
            ...(input?.dateTo && { lte: input.dateTo }),
          },
          deletedAt: null,
        },
      })) as Voucher[];

      // Para cada voucher, obtemos os dados de pagamento do MercadoPago
      const vouchersWithPaymentDetails = await Promise.all(
        vouchers.map(
          async (voucher: Voucher): Promise<VoucherWithPaymentDetails> => {
            if (!voucher.payment_id) {
              return {
                ...voucher,
                paymentDetails: {
                  method_id: "unknown",
                  method_name: "Desconhecido",
                },
              } as VoucherWithPaymentDetails;
            }

            try {
              // Fazemos a chamada para a API do MercadoPago
              const token = process.env.MERCADOPAGO_TOKEN;
              if (!token) {
                throw new Error("MERCADOPAGO_TOKEN is not set");
              }

              const url = `https://api.mercadopago.com/v1/payments/${voucher.payment_id}`;
              const res = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!res.ok) {
                return {
                  ...voucher,
                  paymentDetails: {
                    method_id: "unknown",
                    method_name: "Desconhecido",
                  },
                } as VoucherWithPaymentDetails;
              }

              const paymentData = (await res.json()) as PaymentResponse;

              // Extraindo informações mais detalhadas do pagamento
              return {
                ...voucher,
                paymentDetails: {
                  // Use payment_method_id if available, otherwise fallback to payment_type_id
                  method_id:
                    paymentData.payment_method_id ??
                    paymentData.payment_type_id ??
                    "unknown",
                  method_name:
                    paymentData.payment_method_id ??
                    paymentData.payment_type_id ??
                    "Desconhecido",
                  // Additional details
                  payment_method_id: paymentData.payment_method_id,
                  card_brand:
                    paymentData.card?.cardholder?.name ??
                    paymentData.card?.last_four_digits,
                  installments: paymentData.installments,
                },
              } as VoucherWithPaymentDetails;
            } catch (error: unknown) {
              const err =
                error instanceof Error ? error : new Error(String(error));
              console.error(
                `Error fetching payment details for voucher ${voucher.id ?? "unknown"}:`,
                err.message,
              );
              return {
                ...voucher,
                paymentDetails: {
                  method_id: "unknown",
                  method_name: "Desconhecido",
                },
              } as VoucherWithPaymentDetails;
            }
          },
        ),
      );

      return vouchersWithPaymentDetails;
    }),
});
