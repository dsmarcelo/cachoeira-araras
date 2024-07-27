"use server";
import { type Voucher } from "@prisma/client";
import { api } from "@/trpc/server";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
): Promise<Voucher | void> {
  console.log("🚀 ~ preference_id:", preference_id);
  const oldVoucher = await api.voucher.findByPreferenceId({ preference_id });
  console.log("🚀 ~ oldVoucher:", oldVoucher);
  if (!oldVoucher) return console.error("Voucher não encontrado");
  if (oldVoucher.status !== "pending") {
    return oldVoucher;
  }

  try {
    const voucher = await api.voucher.updateByPreference_id({
      preference_id,
      data: {
        status: "valid",
        valid: true,
        payment_id,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 31),
      },
    });
    if (!voucher) console.error("Failed to update voucher");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw error;
  }
}
