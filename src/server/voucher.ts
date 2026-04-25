import "server-only";

import { type Prisma } from "@prisma/client";

import { db } from "@/server/db";

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
