"use server";

import { type Voucher } from "@prisma/client";

import {
  confirmVoucherPaymentByCode,
  findVoucherByPreferenceId,
} from "@/server/voucher";
import {
  capturePaymentFlowException,
  capturePaymentFlowMessage,
  startPaymentFlowSpan,
} from "@/lib/sentry/payment";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
): Promise<Voucher | void> {
  try {
    return await startPaymentFlowSpan(
      "confirm_voucher",
      "Confirm voucher after approved Mercado Pago payment",
      { preferenceId: preference_id, paymentId: payment_id },
      async () => {
        const oldVoucher = await findVoucherByPreferenceId(preference_id);
        if (!oldVoucher) {
          capturePaymentFlowMessage(
            "Voucher not found by preference",
            "confirm_voucher",
            {
              preferenceId: preference_id,
              paymentId: payment_id,
            },
          );
          console.error("Voucher não encontrado");
          return;
        }

        const result = await confirmVoucherPaymentByCode({
          code: oldVoucher.code,
          paymentId: payment_id,
          paymentStatus: "approved",
        });

        if (result.outcome === "not_found") {
          capturePaymentFlowMessage(
            "Voucher not found by code",
            "confirm_voucher",
            {
              preferenceId: preference_id,
              paymentId: payment_id,
              voucherCode: oldVoucher.code,
            },
          );
          console.error("Voucher não encontrado");
          return;
        }

        return result.voucher;
      },
    );
  } catch (error) {
    capturePaymentFlowException(error, "confirm_voucher", {
      preferenceId: preference_id,
      paymentId: payment_id,
    });
    throw error;
  }
}
