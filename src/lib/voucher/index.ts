"use server";
import { type Voucher } from "@prisma/client";
import { api } from "@/trpc/server";

// const utils = api.useUtils();

export async function formatVoucherStatus(status: string) {
  if (!status) return "Voucher inválido";
  switch (status) {
    case "pending":
      return "Aguardando pagamento";
    case "valid":
      return "Voucher válido";
    case "redeemed":
      return "Voucher já resgatado";
    case "expired":
      return "Voucher expirado";
    default:
      return "Voucher inválido";
  }
}

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
