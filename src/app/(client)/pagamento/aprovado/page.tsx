import CustomerVoucher from "@/app/_components/customer-voucher";
import { loadCustomerVoucher } from "@/server/load-customer-voucher";

export default async function ApprovedPaymentPage({
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
  return (
    <CustomerVoucher
      data={await loadCustomerVoucher(
        { preferenceId: preference_id },
        payment_id,
      )}
    />
  );
}
