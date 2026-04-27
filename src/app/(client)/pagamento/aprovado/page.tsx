import React from "react";
import PaymentCard from "@/app/_components/payment-card";
import VoucherCard from "@/app/_components/voucher-card";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { confirmVoucherPayment } from "@/lib/voucher/server-utils";
import DeleteVoucherCookieBtn from "@/app/_components/delete-voucher-cookie-btn";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  getMercadoPagoPayment,
  getMercadoPagoPreference,
} from "@/server/mercadopago";

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

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const allStrings = Object.values(searchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    return <div className="h-screen text-center text-3xl">Link inválido</div>;
  }

  const { preference_id, payment_id } = searchParams;
  if (!preference_id || !payment_id)
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Link inválido</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );

  const preference = await fetchPreference(preference_id as string);

  if (!preference)
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Erro ao buscar preferência</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );

  const payment = await fetchPayment(payment_id as string);

  if (!payment)
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Erro ao buscar pagamento</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );

  if (!preference)
    return (
      <div>
        <div className="h-screen text-center text-3xl">
          Erro ao buscar preferência
        </div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );

  if (payment.status === "approved") {
    const voucher = await confirmVoucherPayment(
      preference_id as string,
      payment_id as string,
    );
    if (!voucher)
      return (
        <div className="h-screen text-center text-3xl">
          Não foi possível confirmar o pagamento
        </div>
      );

    return (
      <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
        <h1 className="mb-8 text-center text-2xl font-bold text-green-500">
          Pagamento aprovado
        </h1>
        <div className="flex w-full max-w-lg flex-col gap-8">
          <PaymentCard data={preference} payment_id={payment_id as string} />
          <VoucherCard data={voucher} />
          <DeleteVoucherCookieBtn />
        </div>
      </div>
    );
  }
}
