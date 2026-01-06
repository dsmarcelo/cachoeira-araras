"use client";

import React from "react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/ui/use-toast";
import { useTrpcErrorHandler } from "@/hooks/use-trpc-error-handler";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import { confirmVoucherPayment } from "@/lib/voucher/server-utils";
import PendingPaymentCard from "./pendingPayment";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";

interface PaymentClientWrapperProps {
  preferenceId: string;
  paymentId: string;
  initialPayment: PaymentResponse | null;
  initialPreference: PreferenceResponse | null;
}

/**
 * Client component wrapper for payment page
 * Handles errors with toast notifications and provides better UX
 */
export default function PaymentClientWrapper({
  preferenceId,
  paymentId,
  initialPayment,
  initialPreference,
}: PaymentClientWrapperProps) {
  const { toast } = useToast();
  const { handleError } = useTrpcErrorHandler();
  const router = useRouter();

  // Fetch preference with error handling
  const {
    data: preference,
    error: preferenceError,
    isLoading: isLoadingPreference,
  } = api.mercadopago.getPrefence.useQuery(
    { preference_id: preferenceId },
    {
      initialData: initialPreference ?? undefined,
      enabled: !!preferenceId,
      retry: 2,
    }
  );

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

  // Handle errors with toast notifications
  React.useEffect(() => {
    if (preferenceError) {
      handleError(preferenceError, "Erro ao buscar informações da preferência de pagamento.");
    }
  }, [preferenceError, handleError]);

  React.useEffect(() => {
    if (paymentError) {
      handleError(paymentError, "Erro ao buscar informações do pagamento. Tente novamente.");
    }
  }, [paymentError, handleError]);

  // Handle payment confirmation
  const handlePaymentConfirmation = React.useCallback(async () => {
    if (!preferenceId || !paymentId) return;

    try {
      const voucher = await confirmVoucherPayment(preferenceId, paymentId);
      if (!voucher) {
        toast({
          title: "Erro ao confirmar pagamento",
          description: "Não foi possível confirmar o pagamento. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Redirect to approved page
      router.push(
        `/pagamento/aprovado?preference_id=${preferenceId}&payment_id=${paymentId}`
      );
    } catch (error) {
      handleError(error, "Erro ao confirmar o pagamento. Tente novamente.");
    }
  }, [preferenceId, paymentId, toast, handleError, router]);

  // Auto-confirm when payment is approved
  React.useEffect(() => {
    if (payment?.status === "approved" && preference && !isLoadingPayment && !isLoadingPreference) {
      void handlePaymentConfirmation();
    }
  }, [payment?.status, preference, isLoadingPayment, isLoadingPreference, handlePaymentConfirmation]);

  // Show error states
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  if (preferenceError || paymentError) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Erro ao carregar informações
          </h2>
          <p className="text-lg text-primary-200">
            {preferenceError
              ? "Não foi possível carregar as informações da preferência de pagamento."
              : "Não foi possível carregar as informações do pagamento."}
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
  if (isLoadingPayment || isLoadingPreference) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="text-center">
          <p className="text-lg text-primary-100">Carregando informações do pagamento...</p>
        </div>
      </div>
    );
  }

  // Validate data
  if (!preference) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Preferência não encontrada
          </h2>
          <p className="text-lg text-primary-200">
            Não foi possível encontrar as informações da preferência de pagamento.
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

  // Handle payment status
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

  if (payment.status === "pending" && preference.init_point) {
    return <PendingPaymentCard paymentURL={preference.init_point} />;
  }

  if (payment.status === "approved") {
    // This will be handled by the useEffect above
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="text-center">
          <p className="text-lg text-primary-100">Confirmando pagamento...</p>
        </div>
      </div>
    );
  }

  // Unknown status
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold text-primary-100">
          Status de pagamento desconhecido
        </h2>
        <p className="text-lg text-primary-200">
          O status do pagamento não pôde ser determinado.
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


