import type { Prisma } from "@prisma/client";
import { startOfBrazilDay } from "./voucher-expiry.ts";

type UpdateMany = (
  args: Prisma.VoucherUpdateManyArgs,
) => Promise<{ count: number }>;

// Only visit dates before today (Brasília) are past; today's vouchers are kept.
export async function runVoucherMaintenance(
  updateMany: UpdateMany,
  now: Date = new Date(),
) {
  const startOfToday = startOfBrazilDay(now);
  const expired = await updateMany({
    where: {
      expires_at: { lt: startOfToday },
      valid: true,
      status: "valid",
      deletedAt: null,
    },
    data: { valid: false, status: "expired" },
  });
  const deleted = await updateMany({
    where: {
      expires_at: { lt: startOfToday },
      valid: false,
      status: "pending",
      deletedAt: null,
    },
    data: { deletedAt: now },
  });
  return {
    expiredVouchers: expired.count,
    softDeletedPendingVouchers: deleted.count,
  };
}
