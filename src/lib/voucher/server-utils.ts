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
  if (!oldVoucher) throw new Error("Voucher não encontrado");
  if (oldVoucher?.status !== "pending") {
    throw new Error("Status inválido");
  }

  try {
    const voucher = await api.voucher.update({
      where: { preference_id },
      data: {
        status: "valid",
        valid: true,
        payment_id,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31),
      },
    });
    if (!voucher) throw new Error("Failed to update voucher");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw error;
  }
}
