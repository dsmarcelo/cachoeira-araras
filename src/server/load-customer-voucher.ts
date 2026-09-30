import "server-only";
import { findVoucherByCode, findVoucherByPreferenceId } from "./voucher";
import { getMercadoPagoPreference } from "./mercadopago";
import { syncVoucherPayment } from "./voucher-payment-sync";
import { capturePaymentFlowException } from "@/lib/sentry/payment";

export async function loadCustomerVoucher(
  identifier: { code: string } | { preferenceId: string },
  paymentId?: string,
) {
  if ("code" in identifier && !paymentId) return null;
  const voucher =
    "code" in identifier
      ? await findVoucherByCode(identifier.code)
      : await findVoucherByPreferenceId(identifier.preferenceId);
  if (!voucher || voucher.deletedAt) return null;
  let preferenceError = false;
  const preference = await getMercadoPagoPreference(
    voucher.preference_id,
  ).catch((error: unknown) => {
    preferenceError = true;
    capturePaymentFlowException(error, "fetch_preference", {
      preferenceId: voucher.preference_id,
    });
    return null;
  });
  if (preference && preference.external_reference !== voucher.code) return null;
  const result = await syncVoucherPayment(voucher, paymentId, true);
  // Short voucher codes alone cannot grant access to customer details when
  // Mercado Pago is unavailable. A previously stored payment id can.
  if (
    "code" in identifier &&
    result.syncError === "unavailable" &&
    paymentId !== voucher.payment_id
  )
    return null;
  if (result.syncError === "invalid_payment" || result.voucher.deletedAt)
    return null;
  return {
    ...result,
    preference,
    syncWarning:
      result.syncError || preferenceError
        ? "Não foi possível atualizar o pagamento agora. Tente novamente em instantes."
        : null,
  };
}
