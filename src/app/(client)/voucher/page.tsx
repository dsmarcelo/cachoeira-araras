import React from "react";
import PaymentCard from "@/app/_components/payment-card";
import VoucherCard from "@/app/_components/voucher-card";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import DeleteVoucherCookieBtn from "@/app/_components/delete-voucher-cookie-btn";
import {
  getMercadoPagoPayment,
  getMercadoPagoPreference,
} from "@/server/mercadopago";
import { findVoucherByCode } from "@/server/voucher";

const fetchPreference = async (
  preference_id: string,
): Promise<PreferenceResponse | null> => {
  try {
    return await getMercadoPagoPreference(preference_id);
  } catch (error) {
    console.error("Error fetching payment:", error);
    throw error;
  }
};

const fetchPayment = async (
  payment_id: string,
): Promise<PaymentResponse | null> => {
  try {
    return await getMercadoPagoPayment(payment_id);
  } catch (error) {
    console.error("Error fetching payment:", error);
    throw error;
  }
};

export default async function VoucherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Next.js 16 provides page `searchParams` asynchronously. Resolve the query
  // once, then keep the existing defensive checks that reject multi-value URLs.
  const resolvedSearchParams = await searchParams;
  const allStrings = Object.values(resolvedSearchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    return <div className="h-screen text-center text-3xl">Link inválido</div>;
  }

  const { code, pid } = resolvedSearchParams;
  if (!code || !pid || typeof code !== "string" || typeof pid !== "string") {
    return <div className="h-screen text-center text-3xl">Link inválido</div>;
  }

  const payment = await fetchPayment(pid);
  if (!payment) {
    return (
      <div className="h-screen text-center text-3xl">
        Erro ao buscar pagamento
      </div>
    );
  }

  if (payment.status === "denied") {
    return <div>Pagamento não aprovado</div>;
  }

  const voucher = await findVoucherByCode(code);

  if (!voucher) {
    return (
      <div className="h-screen text-center text-3xl">
        Não foi possível encontrar o voucher
      </div>
    );
  }

  const preference = await fetchPreference(voucher.preference_id);

  return (
    <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-primary-100">
        Obrigado por comprar seu voucher na Cachoeira das Araras!
      </h1>
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        {preference && <PaymentCard data={preference} payment_id={pid} />}
        <VoucherCard data={voucher} />
        <DeleteVoucherCookieBtn />
      </div>
    </div>
  );
}
