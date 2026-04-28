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
import {
  capturePaymentFlowException,
  capturePaymentFlowMessage,
} from "@/lib/sentry/payment";

const fetchPreference = async (
  preference_id: string,
): Promise<PreferenceResponse | null> => {
  try {
    return await getMercadoPagoPreference(preference_id);
  } catch (error) {
    capturePaymentFlowException(error, "fetch_preference", {
      preferenceId: preference_id,
    });
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
    capturePaymentFlowException(error, "fetch_payment", {
      paymentId: payment_id,
    });
    console.error("Error fetching payment:", error);
    throw error;
  }
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Next.js 16 resolves page query params asynchronously. Await them once so
  // all payment confirmation checks operate on the same validated query data.
  const resolvedSearchParams = await searchParams;
  const allStrings = Object.values(resolvedSearchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    capturePaymentFlowMessage(
      "Payment approved page received invalid multi-value query",
      "payment_return",
    );
    return <div className="h-screen text-center text-3xl">Link inválido</div>;
  }

  const { preference_id, payment_id } = resolvedSearchParams;
  if (
    !preference_id ||
    !payment_id ||
    typeof preference_id !== "string" ||
    typeof payment_id !== "string"
  )
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Link inválido</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );

  const preference = await fetchPreference(preference_id);

  if (!preference) {
    capturePaymentFlowMessage(
      "Approved payment preference not found",
      "payment_return",
      {
        preferenceId: preference_id,
        paymentId: payment_id,
      },
    );
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Erro ao buscar preferência</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );
  }

  const payment = await fetchPayment(payment_id);

  if (!payment) {
    capturePaymentFlowMessage("Approved payment not found", "payment_return", {
      preferenceId: preference_id,
      paymentId: payment_id,
    });
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Erro ao buscar pagamento</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );
  }

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
    const voucher = await confirmVoucherPayment(preference_id, payment_id);
    if (!voucher) {
      capturePaymentFlowMessage(
        "Approved payment but voucher confirmation failed",
        "payment_return",
        {
          preferenceId: preference_id,
          paymentId: payment_id,
        },
      );
      return (
        <div className="h-screen text-center text-3xl">
          Não foi possível confirmar o pagamento
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
        <h1 className="mb-8 text-center text-2xl font-bold text-green-500">
          Pagamento aprovado
        </h1>
        <div className="flex w-full max-w-lg flex-col gap-8">
          <PaymentCard data={preference} payment_id={payment_id} />
          <VoucherCard data={voucher} />
          <DeleteVoucherCookieBtn />
        </div>
      </div>
    );
  }
}
