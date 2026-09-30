import { redirect } from "next/navigation";
import CustomerVoucher from "@/app/_components/customer-voucher";
import { loadCustomerVoucher } from "@/server/load-customer-voucher";
import PendingPaymentCard from "./pendingPayment";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { preference_id, payment_id } = await searchParams;
  if (
    typeof preference_id !== "string" ||
    !preference_id ||
    preference_id.length > 200 ||
    (payment_id !== undefined &&
      (typeof payment_id !== "string" || !/^\d{1,30}$/.test(payment_id)))
  ) {
    return <CustomerVoucher data={null} />;
  }
  const result = await loadCustomerVoucher(
    { preferenceId: preference_id },
    payment_id,
  );
  if (
    result &&
    result.voucher.status !== "pending" &&
    result.voucher.payment_id
  ) {
    redirect(
      `/pagamento/aprovado?preference_id=${encodeURIComponent(preference_id)}&payment_id=${encodeURIComponent(result.voucher.payment_id)}`,
    );
  }
  if (result && !result.syncWarning && result.preference?.init_point) {
    return <PendingPaymentCard paymentURL={result.preference.init_point} />;
  }
  return <CustomerVoucher data={result} />;
}
