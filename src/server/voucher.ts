import "server-only";

import { type Prisma } from "@prisma/client";

import { db } from "@/server/db";

import {
  confirmVoucherPayment,
  type ConfirmVoucherPaymentInput,
  type VoucherPaymentResult,
} from "./voucher-payment-confirmation";

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
}: ConfirmVoucherPaymentInput): Promise<VoucherPaymentResult> {
  return await confirmVoucherPaymentByCode({
    code,
    paymentId,
    paymentStatus,
  });
}

export async function confirmVoucherPaymentByCode({
  code,
  paymentId,
  paymentStatus,
}: ConfirmVoucherPaymentInput): Promise<VoucherPaymentResult> {
  return await confirmVoucherPayment(
    { code, paymentId, paymentStatus },
    { findVoucher: findVoucherByCode, updateMany: (args) => db.voucher.updateMany(args) },
  );
}
