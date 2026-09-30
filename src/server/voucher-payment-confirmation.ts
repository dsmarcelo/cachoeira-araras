import type { Prisma, Voucher } from "@prisma/client";

export type ConfirmVoucherPaymentInput = {
  code: string;
  paymentId: string;
  paymentStatus: string | null | undefined;
};

export type VoucherPaymentResult =
  | { outcome: "not_found"; shouldSendConversionEvents: false; voucher: null }
  | {
      outcome: "already_processed" | "redeemed" | "updated";
      shouldSendConversionEvents: boolean;
      voucher: Voucher;
    };

export async function confirmVoucherPayment(
  { code, paymentId, paymentStatus }: ConfirmVoucherPaymentInput,
  dependencies: {
    findVoucher: (code: string) => Promise<Voucher | null>;
    updateMany: (
      args: Prisma.VoucherUpdateManyArgs,
    ) => Promise<{ count: number }>;
  },
): Promise<VoucherPaymentResult> {
  const voucher = await dependencies.findVoucher(code);
  if (!voucher || voucher.deletedAt) {
    return {
      outcome: "not_found",
      shouldSendConversionEvents: false,
      voucher: null,
    };
  }
  if (voucher.status === "redeemed" || voucher.status === "used") {
    return { outcome: "redeemed", shouldSendConversionEvents: false, voucher };
  }
  if (voucher.status !== "pending") {
    return {
      outcome: "already_processed",
      shouldSendConversionEvents: false,
      voucher,
    };
  }
  const approved = paymentStatus === "approved";
  // A pending voucher may already be expired before scheduled maintenance runs.
  // Record its payment without changing its status or validity.
  const expired =
    voucher.expires_at !== null && voucher.expires_at.getTime() <= Date.now();
  if (expired && voucher.payment_id === paymentId) {
    return {
      outcome: "already_processed",
      shouldSendConversionEvents: false,
      voucher,
    };
  }
  const result = await dependencies.updateMany({
    // Compare the snapshot as well as the status: webhook and screen recovery
    // may race, but only one caller may confirm or replace a pending payment.
    where: {
      code,
      status: "pending",
      deletedAt: null,
      payment_id: voucher.payment_id,
      expires_at: voucher.expires_at,
    },
    data: {
      payment_id: paymentId,
      ...(approved && !expired && { status: "valid", valid: true }),
    },
  });
  const updatedVoucher = await dependencies.findVoucher(code);
  if (!updatedVoucher) {
    return {
      outcome: "not_found",
      shouldSendConversionEvents: false,
      voucher: null,
    };
  }
  return {
    outcome: result.count ? "updated" : "already_processed",
    shouldSendConversionEvents: approved && result.count > 0,
    voucher: updatedVoucher,
  };
}
