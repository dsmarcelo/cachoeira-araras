"use server";

import { type Voucher } from "@prisma/client";

import {
  confirmVoucherPaymentByCode,
  findVoucherByPreferenceId,
} from "@/server/voucher";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
): Promise<Voucher | void> {
  const oldVoucher = await findVoucherByPreferenceId(preference_id);
  if (!oldVoucher) {
    console.error("Voucher não encontrado");
    return;
  }

  const result = await confirmVoucherPaymentByCode({
    code: oldVoucher.code,
    paymentId: payment_id,
    paymentStatus: "approved",
  });

  if (result.outcome === "not_found") {
    console.error("Voucher não encontrado");
    return;
  }

  return result.voucher;
}
