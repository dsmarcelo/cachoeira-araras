import PaymentCard from "./payment-card";
import VoucherCard from "./voucher-card";
import DeleteVoucherCookieBtn from "./delete-voucher-cookie-btn";
import RefreshVoucherButton from "./refresh-voucher-button";
import type { loadCustomerVoucher } from "@/server/load-customer-voucher";

export default function CustomerVoucher({
  data,
}: {
  data: Awaited<ReturnType<typeof loadCustomerVoucher>>;
}) {
  if (!data)
    return (
      <div className="h-screen text-center text-3xl">
        Link inválido ou voucher não encontrado
      </div>
    );
  const { voucher, preference, syncWarning } = data;
  const confirmed = voucher.status !== "pending" && voucher.payment_id;
  return (
    <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-primary-100">
        {confirmed
          ? "Pagamento confirmado"
          : "Aguardando confirmação do pagamento"}
      </h1>
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        {syncWarning && (
          <p role="alert" className="text-center text-primary-100">
            {syncWarning}
          </p>
        )}
        {preference && voucher.payment_id && (
          <PaymentCard data={preference} payment_id={voucher.payment_id} />
        )}
        <VoucherCard data={voucher} />
        {(!confirmed || syncWarning) && <RefreshVoucherButton />}
        <DeleteVoucherCookieBtn />
      </div>
    </div>
  );
}
