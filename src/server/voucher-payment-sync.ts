import "server-only";
import type { Voucher } from "@prisma/client";
import {
  createVoucherPaymentSync,
  syncDisplayedVoucherPage,
} from "./voucher-payment-sync-core";
import { db } from "./db";
import {
  getMercadoPagoPayment,
  searchMercadoPagoPaymentsByExternalReference,
} from "./mercadopago";
import { confirmVoucherPaymentByCode, findVoucherByCode } from "./voucher";
import { sendPaymentConversionEvents } from "./payment-conversion-events";
import { capturePaymentFlowException } from "@/lib/sentry/payment";

// Bounded cooldown and concurrency are per process. Atomic database confirmation
// remains the authority across processes; no schema migration is needed.
const sync = createVoucherPaymentSync({
  getPayment: getMercadoPagoPayment,
  searchPayments: searchMercadoPagoPaymentsByExternalReference,
  confirmPayment: confirmVoucherPaymentByCode,
  sendConversionEvents: sendPaymentConversionEvents,
  onError: (error, code) =>
    capturePaymentFlowException(error, "confirm_voucher", {
      voucherCode: code,
    }),
});

export async function syncVoucherPayment(
  voucher: Voucher,
  paymentId?: string,
  fresh = false,
) {
  const result = await sync(voucher, paymentId, fresh);
  // A redeem/delete action may finish while the payment request is in flight.
  const current = await findVoucherByCode(voucher.code);
  return { ...result, voucher: current ?? result.voucher };
}

export async function syncDisplayedVouchers(vouchers: Voucher[]) {
  return await syncDisplayedVoucherPage(vouchers, {
    sync,
    reload: (ids) => db.voucher.findMany({ where: { id: { in: ids } } }),
  });
}
