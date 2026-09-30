import CustomerVoucher from "@/app/_components/customer-voucher";
import { loadCustomerVoucher } from "@/server/load-customer-voucher";

export default async function VoucherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code, pid } = await searchParams;
  if (
    typeof code !== "string" ||
    !/^[a-z0-9]{3,4}$/i.test(code) ||
    typeof pid !== "string" ||
    !/^\d{1,30}$/.test(pid)
  ) {
    return <CustomerVoucher data={null} />;
  }
  return <CustomerVoucher data={await loadCustomerVoucher({ code }, pid)} />;
}
