import "server-only";

import { type Prisma, type Voucher } from "@prisma/client";

import { db } from "@/server/db";

type ProcessVoucherPaymentInput = {
  code: string;
  paymentId: string;
  paymentStatus: string | null | undefined;
};

type ProcessVoucherPaymentResult =
  | {
      outcome: "not_found";
      shouldSendConversionEvents: false;
      voucher: null;
    }
  | {
      outcome: "already_processed" | "redeemed" | "updated";
      shouldSendConversionEvents: boolean;
      voucher: Voucher;
    };

export async function findVoucherByCode(code: string) {
  return await db.voucher.findFirst({
    where: {
      code,
    },
  });
}

export async function findVoucherByPreferenceId(preferenceId: string) {
  return await db.voucher.findFirst({
    where: {
      preference_id: preferenceId,
    },
  });
}

export async function updateVoucherByCode(
  code: string,
  data: Prisma.VoucherUpdateInput,
) {
  return await db.voucher.update({
    where: {
      code,
    },
    data,
  });
}

export async function updateVoucherByPreferenceId(
  preferenceId: string,
  data: Prisma.VoucherUpdateInput,
) {
  return await db.voucher.update({
    where: {
      preference_id: preferenceId,
    },
    data,
  });
}

export async function processVoucherPaymentWebhook({
  code,
  paymentId,
  paymentStatus,
}: ProcessVoucherPaymentInput): Promise<ProcessVoucherPaymentResult> {
  const voucher = await findVoucherByCode(code);

  if (!voucher) {
    return {
      outcome: "not_found",
      shouldSendConversionEvents: false,
      voucher: null,
    };
  }

  if (voucher.status === "redeemed") {
    return {
      outcome: "redeemed",
      shouldSendConversionEvents: false,
      voucher,
    };
  }

  if (voucher.status === "valid") {
    return {
      outcome: "already_processed",
      shouldSendConversionEvents: false,
      voucher,
    };
  }

  if (paymentStatus !== "approved") {
    const updatedVoucher = await updateVoucherByCode(code, {
      payment_id: paymentId,
    });

    return {
      outcome: "updated",
      shouldSendConversionEvents: false,
      voucher: updatedVoucher,
    };
  }

  const updateResult = await db.voucher.updateMany({
    where: {
      code,
      status: {
        not: "valid",
      },
    },
    data: {
      status: "valid",
      valid: true,
      payment_id: paymentId,
    },
  });

  const updatedVoucher = await findVoucherByCode(code);

  if (!updatedVoucher) {
    return {
      outcome: "not_found",
      shouldSendConversionEvents: false,
      voucher: null,
    };
  }

  return {
    outcome: updateResult.count === 0 ? "already_processed" : "updated",
    shouldSendConversionEvents: updateResult.count > 0,
    voucher: updatedVoucher,
  };
}
