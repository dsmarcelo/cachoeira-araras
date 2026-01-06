import React from "react";
import { api } from "@/trpc/server";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";
import PaymentClientWrapper from "./payment-client-wrapper";
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

export default async function PaymentPage({
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

  const { preference_id, payment_id } = searchParams;
  if (
    !preference_id ||
    !payment_id ||
    typeof preference_id !== "string" ||
    typeof payment_id !== "string"
  ) {
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

  // Fetch initial data on server
  const [payment, preference] = await Promise.all([
    fetchPayment(payment_id),
    fetchPreference(preference_id),
  ]);

  return (
    <ErrorBoundary>
      <PaymentClientWrapper
        preferenceId={preference_id}
        paymentId={payment_id}
        initialPayment={payment}
        initialPreference={preference}
      />
    </ErrorBoundary>
  );
}
