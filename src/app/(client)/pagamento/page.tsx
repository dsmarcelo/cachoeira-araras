import React from "react";
import { api } from "@/trpc/server";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { confirmVoucherPayment } from "@/lib/voucher/server-utils";
import PendingPaymentCard from "./pendingPayment";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const fetchPreference = async (
  preference_id: string,
): Promise<PreferenceResponse | null> => {
  try {
    const res = await api.mercadopago.getPreference({ preference_id });
    if (!res) return null;
    return res;
  } catch (error) {
    console.error("Error fetching payment:", error);
    throw error;
  }
};

const fetchPayment = async (
  payment_id: string,
): Promise<PaymentResponse | null> => {
  try {
    const res = await api.mercadopago.getPayment({ payment_id });
    if (!res) return null;
    return res;
  } catch (error) {
    console.error("Error fetching payment:", error);
    throw error;
  }
};

export default async function PaymentApprovedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const allStrings = Object.values(searchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">
          Link inválido
        </div>
        <Link href="/">
          <Button>
            Voltar para a página inicial
          </Button>
        </Link>
      </div>
    );
  }

  const { preference_id, payment_id } = searchParams;
  if (
    !preference_id ||
    !payment_id ||
    typeof preference_id !== "string" ||
    typeof payment_id !== "string"
  )
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">
          Link inválido
        </div>
        <Link href="/">
          <Button>
            Voltar para a página inicial
          </Button>
        </Link>
      </div>
    );

  const preference = await fetchPreference(preference_id);
  if (!preference)
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">
          Erro ao buscar preferência
        </div>
        <Link href="/">
          <Button>
            Voltar para a página inicial
          </Button>
        </Link>
      </div>
    );
  const paymentURL = preference.init_point;

  const payment = await fetchPayment(payment_id);

  if (!payment)
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">
          Erro ao buscar pagamento
        </div>
        <Link href="/">
          <Button>
            Voltar para a página inicial
          </Button>
        </Link>
      </div>
    );

  if (payment.status === "denied") {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">
          Pagamento não aprovado
        </div>
        <Link href="/">
          <Button>
            Voltar para a página inicial
          </Button>
        </Link>
      </div>
    );
  }
  if (payment.status === "pending" && paymentURL) {
    return <PendingPaymentCard paymentURL={paymentURL} />;
  }
  if (payment.status === "approved") {
    const voucher = await confirmVoucherPayment(preference_id, payment_id);
    if (!voucher)
      return (
        <div className="flex h-screen flex-col items-center justify-center">
          <div className="text-center text-3xl">
            Não foi possível confirmar o pagamento
          </div>
          <Link href="/">
            <Button>
              Voltar para a página inicial
            </Button>
          </Link>
        </div>
      );

    return redirect(
      `/pagamento/aprovado?preference_id=${preference_id}&payment_id=${payment_id}`,
    );
  }
}
