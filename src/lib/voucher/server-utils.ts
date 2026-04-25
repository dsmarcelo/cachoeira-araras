"use server";

import { type Voucher } from "@prisma/client";

import {
  findVoucherByPreferenceId,
  updateVoucherByPreferenceId,
} from "@/server/voucher";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
): Promise<Voucher | void> {
  const oldVoucher = await findVoucherByPreferenceId(preference_id);

  if (!oldVoucher) return console.error("Voucher nÃ£o encontrado");
  if (oldVoucher.status !== "pending") {
    return oldVoucher;
  }

  try {
    const voucher = await updateVoucherByPreferenceId(preference_id, {
      status: "valid",
      valid: true,
      payment_id,
    });

    if (!voucher) console.error("Failed to update voucher");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw error;
  }
}
