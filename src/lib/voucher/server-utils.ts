"use server";

import { loadCustomerVoucher } from "@/server/load-customer-voucher";

export async function confirmVoucherPayment(
  preference_id: string,
  payment_id: string,
) {
  const result = await loadCustomerVoucher(
    { preferenceId: preference_id },
    payment_id,
  );
  if (
    !result ||
    result.voucher.status === "pending" ||
    !result.voucher.payment_id
  )
    return;
  return result.voucher;
}
