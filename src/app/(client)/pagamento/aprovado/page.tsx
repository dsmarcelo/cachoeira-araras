"use client";

import React, { useEffect, Suspense } from "react";
import { api } from "@/trpc/react";
import PaymentCard from "@/app/_components/payment-card";
import VoucherCard from "@/app/_components/voucher-card";
import { confirmVoucherPayment } from "@/lib/voucher/server-utils";
import DeleteVoucherCookieBtn from "@/app/_components/delete-voucher-cookie-btn";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTrpcErrorHandler } from "@/hooks/use-trpc-error-handler";
import { useSearchParams } from "next/navigation";

function ApprovedPageContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { handleError } = useTrpcErrorHandler();

  const preferenceId = searchParams.get("preference_id");
  const paymentId = searchParams.get("payment_id");

  // Fetch preference with error handling
  const {
    data: preference,
    error: preferenceError,
    isLoading: isLoadingPreference,
  } = api.mercadopago.getPrefence.useQuery(
    { preference_id: preferenceId ?? "" },
    {
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
    { payment_id: paymentId ?? "" },
    {
      enabled: !!paymentId,
      retry: 2,
    }
  );

  // Handle errors with toast notifications
  useEffect(() => {
    if (preferenceError) {
      handleError(preferenceError, "Erro ao buscar informações da preferência de pagamento.");
    }
  }, [preferenceError, handleError]);

  useEffect(() => {
    if (paymentError) {
      handleError(paymentError, "Erro ao buscar informações do pagamento.");
    }
  }, [paymentError, handleError]);

  // Fetch voucher
  const [voucher, setVoucher] = React.useState<Awaited<ReturnType<typeof confirmVoucherPayment>> | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);

  // Confirm payment when data is loaded
  useEffect(() => {
    if (
      payment?.status === "approved" &&
      preferenceId &&
      paymentId &&
      !voucher &&
      !isConfirming &&
      !isLoadingPayment &&
      !isLoadingPreference
    ) {
      setIsConfirming(true);
      confirmVoucherPayment(preferenceId, paymentId)
        .then((confirmedVoucher) => {
          if (confirmedVoucher) {
            setVoucher(confirmedVoucher);
            toast({
              title: "Pagamento confirmado",
              description: "Seu pagamento foi confirmado com sucesso!",
              variant: "default",
            });
          } else {
            toast({
              title: "Erro ao confirmar pagamento",
              description: "Não foi possível confirmar o pagamento. Tente novamente.",
              variant: "destructive",
            });
          }
        })
        .catch((error) => {
          handleError(error, "Erro ao confirmar o pagamento. Tente novamente.");
        })
        .finally(() => {
          setIsConfirming(false);
        });
    }
  }, [
    payment?.status,
    preferenceId,
    paymentId,
    voucher,
    isConfirming,
    isLoadingPayment,
    isLoadingPreference,
    toast,
    handleError,
  ]);

  // Validate params
  if (!preferenceId || !paymentId) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">Link inválido</h2>
          <p className="text-lg text-primary-200">
            ID da preferência ou ID do pagamento não fornecido.
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
  if (isLoadingPayment || isLoadingPreference || isConfirming) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="text-center">
          <p className="text-lg text-primary-100">
            {isConfirming
              ? "Confirmando pagamento..."
              : "Carregando informações do pagamento..."}
          </p>
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

  if (payment.status !== "approved") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">
            Pagamento não aprovado
          </h2>
          <p className="text-lg text-primary-200">
            O status do pagamento não é &quot;aprovado&quot;. Status atual: {payment.status}
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
            Não foi possível confirmar o pagamento e criar o voucher.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Button onClick={() => window.location.reload()} className="h-12">
              Tentar novamente
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

  // Success state - show voucher information
  return (
    <div className="flex w-full flex-col items-center overflow-hidden bg-bg-blue px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-green-500">
        Pagamento aprovado
      </h1>
      <div className="flex w-full max-w-lg flex-col gap-8">
        <PaymentCard data={preference} payment_id={paymentId} />
        <VoucherCard data={voucher} />
        <DeleteVoucherCookieBtn />
      </div>
    </div>
  );
}

export default function ApprovedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
          <div className="text-center">
            <p className="text-lg text-primary-100">Carregando...</p>
          </div>
        </div>
      }
    >
      <ApprovedPageContent />
    </Suspense>
  );
}
