"use client";

import React from "react";
import PaymentCard from "@/app/_components/payment-card";
import VoucherCard from "@/app/_components/voucher-card";
import DeleteVoucherCookieBtn from "@/app/_components/delete-voucher-cookie-btn";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { api, type RouterOutputs } from "@/trpc/react";
import { useTrpcErrorHandler } from "@/hooks/use-trpc-error-handler";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";

interface VoucherClientWrapperProps {
  code: string;
  paymentId: string;
  initialPayment: PaymentResponse | null;
  initialVoucher: RouterOutputs["voucher"]["findByCode"] | null;
  initialPreference: PreferenceResponse | null;
}

/**
 * Client component wrapper for voucher page
 * Handles errors with toast notifications and provides better UX
 */
export default function VoucherClientWrapper({
  code,
  paymentId,
  initialPayment,
  initialVoucher,
  initialPreference,
}: VoucherClientWrapperProps) {
  const { handleError } = useTrpcErrorHandler();

  // Fetch payment with error handling
  const {
    data: payment,
    error: paymentError,
    isLoading: isLoadingPayment,
  } = api.mercadopago.getPayment.useQuery(
    { payment_id: paymentId },
    {
      initialData: initialPayment ?? undefined,
      enabled: !!paymentId,
      retry: 2,
    }
  );

  // Fetch voucher with error handling
  const {
    data: voucher,
    error: voucherError,
    isLoading: isLoadingVoucher,
  } = api.voucher.findByCode.useQuery(
    { code },
    {
      initialData: initialVoucher ?? undefined,
      enabled: !!code,
      retry: 2,
    }
  );

  // Fetch preference with error handling
  // Note: Using getPrefence (typo in API) instead of getPreference
  const {
    data: preference,
    error: preferenceError,
    isLoading: isLoadingPreference,
  } = api.mercadopago.getPrefence.useQuery(
    { preference_id: voucher?.preference_id ?? "" },
    {
      initialData: initialPreference ?? undefined,
      enabled: !!voucher?.preference_id,
      retry: 2,
    }
  );

  // Handle errors with toast notifications
  React.useEffect(() => {
    if (paymentError) {
      handleError(paymentError, "Erro ao buscar informações do pagamento. Tente novamente.");
    }
  }, [paymentError, handleError]);

  React.useEffect(() => {
    if (voucherError) {
      handleError(voucherError, "Erro ao buscar informações do voucher. Verifique o código e tente novamente.");
    }
  }, [voucherError, handleError]);

  React.useEffect(() => {
    if (preferenceError) {
      handleError(preferenceError, "Erro ao buscar informações da preferência de pagamento.");
    }
  }, [preferenceError, handleError]);

  // Show error states
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  if (paymentError || voucherError || preferenceError) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Erro ao carregar informações
          </h2>
          <p className="text-lg text-primary-200">
            {paymentError
              ? "Não foi possível carregar as informações do pagamento."
              : voucherError
              ? "Não foi possível encontrar o voucher."
              : "Não foi possível carregar as informações da preferência."}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Button onClick={() => window.location.reload()} className="h-12">
              Recarregar página
            </Button>
            <Link href="/">
              <Button variant="outline" className="h-12">
                <HomeIcon className="mr-2 h-4 w-4" />
                Voltar para a página inicial
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoadingPayment || isLoadingVoucher || isLoadingPreference) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="text-center">
          <p className="text-lg text-primary-100">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // Validate data
  if (!payment) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Pagamento não encontrado
          </h2>
          <p className="text-lg text-primary-200">
            Não foi possível encontrar as informações do pagamento.
          </p>
          <Link href="/">
            <Button variant="outline" className="h-12">
              <HomeIcon className="mr-2 h-4 w-4" />
              Voltar para a página inicial
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (payment.status === "denied") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-red-400">
            Pagamento não aprovado
          </h2>
          <p className="text-lg text-primary-200">
            O pagamento não foi aprovado. Por favor, tente novamente.
          </p>
          <Link href="/">
            <Button variant="outline" className="h-12">
              <HomeIcon className="mr-2 h-4 w-4" />
              Voltar para a página inicial
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Voucher não encontrado
          </h2>
          <p className="text-lg text-primary-200">
            Não foi possível encontrar o voucher com o código informado.
          </p>
          <Link href="/">
            <Button variant="outline" className="h-12">
              <HomeIcon className="mr-2 h-4 w-4" />
              Voltar para a página inicial
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Success state - show voucher information
  return (
    <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-primary-100">
        Obrigado por comprar seu voucher na Cachoeira das Araras!
      </h1>
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        {preference && (
          <PaymentCard data={preference} payment_id={paymentId} />
        )}
        <VoucherCard data={voucher} />
        <DeleteVoucherCookieBtn />
      </div>
    </div>
  );
}

