"use server";
import { type Voucher } from "@prisma/client";
import { api } from "@/trpc/server";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
): Promise<Voucher | void> {
  const oldVoucher = await api.voucher.findByPreferenceId({
    preference_id,
  });
  if (!oldVoucher) return console.error("Voucher não encontrado");
  if (oldVoucher?.status !== "pending") {
    console.log("🚀 ~ pending:", "pending");
    return oldVoucher;
  }

  try {
    const voucher = await api.voucher.update({
      where: { preference_id },
      data: {
        status: "valid",
        valid: true,
        payment_id,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });
    if (!voucher) console.error("Failed to update voucher");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw error;
  }
}
