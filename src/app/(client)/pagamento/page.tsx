import React from "react";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { confirmVoucherPayment } from "@/lib/voucher/server-utils";
import PendingPaymentCard from "./pendingPayment";
import { redirect } from "next/navigation";
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

export default async function PaymentApprovedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // In Next.js 16, App Router page `searchParams` are asynchronous. Resolve
  // once at the top so the payment validation below works with a stable query
  // snapshot and continues rejecting multi-value tampered URLs.
  const resolvedSearchParams = await searchParams;
  const allStrings = Object.values(resolvedSearchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    capturePaymentFlowMessage(
      "Payment return received invalid multi-value query",
      "payment_return",
    );
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Link inválido</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );
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
      "Payment return preference not found",
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
  const paymentURL = preference.init_point;

  const payment = await fetchPayment(payment_id);

  if (!payment) {
    capturePaymentFlowMessage(
      "Payment return payment not found",
      "payment_return",
      {
        preferenceId: preference_id,
        paymentId: payment_id,
      },
    );
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Erro ao buscar pagamento</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );
  }

  if (payment.status === "denied") {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center text-3xl">Pagamento não aprovado</div>
        <Link href="/">
          <Button>Voltar para a página inicial</Button>
        </Link>
      </div>
    );
  }
  if (payment.status === "pending" && paymentURL) {
    return <PendingPaymentCard paymentURL={paymentURL} />;
  }
  if (payment.status === "approved") {
    const voucher = await confirmVoucherPayment(preference_id, payment_id);
    if (!voucher) {
      capturePaymentFlowMessage(
        "Payment approved but voucher confirmation failed",
        "payment_return",
        {
          preferenceId: preference_id,
          paymentId: payment_id,
        },
      );
      return (
        <div className="flex h-screen flex-col items-center justify-center">
          <div className="text-center text-3xl">
            Não foi possível confirmar o pagamento
          </div>
          <Link href="/">
            <Button>Voltar para a página inicial</Button>
          </Link>
        </div>
      );
    }

    return redirect(
      `/pagamento/aprovado?preference_id=${preference_id}&payment_id=${payment_id}`,
    );
  }
}
