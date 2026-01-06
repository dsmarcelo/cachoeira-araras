import React from "react";
import { api } from "@/trpc/server";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import VoucherClientWrapper from "./voucher-client-wrapper";
import { ErrorBoundary } from "@/app/_components/error-boundary";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";

const fetchPreference = async (
  preference_id: string,
): Promise<PreferenceResponse | null> => {
  try {
    const res = await api.mercadopago.getPreference({ preference_id });
    if (!res) return null;
    return res;
  } catch (error) {
    console.error("Error fetching preference:", error);
    return null;
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
    return null;
  }
};

export default async function voucherPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const allStrings = Object.values(searchParams).every(
    (value) => typeof value === "string",
  );

  if (!allStrings) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">Link inválido</h2>
          <p className="text-lg text-primary-200">
            Os parâmetros da URL são inválidos. Por favor, verifique o link.
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

  const { code, pid } = searchParams;
  if (!code || !pid) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-primary-100">Link inválido</h2>
          <p className="text-lg text-primary-200">
            Código do voucher ou ID do pagamento não fornecido.
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

  // Fetch initial data on server
  const [payment, voucher] = await Promise.all([
    fetchPayment(pid as string),
    api.voucher.findByCode({ code: code as string }).catch(() => null),
  ]);

  const preference = voucher?.preference_id
    ? await fetchPreference(voucher.preference_id)
    : null;

  return (
    <ErrorBoundary>
      <VoucherClientWrapper
        code={code as string}
        paymentId={pid as string}
        initialPayment={payment}
        initialVoucher={voucher}
        initialPreference={preference}
      />
    </ErrorBoundary>
  );
}
