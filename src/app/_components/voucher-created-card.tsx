"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VoucherCreatedCard({
  code,
  redirectToPayment,
  onNewPurchase,
  payment_success_url,
  warning,
}: {
  code: string;
  redirectToPayment: () => void;
  onNewPurchase: () => void;
  payment_success_url: string;
  warning: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-4 text-primary-100">
      {warning && (
        <p role="alert" className="text-orange-100">
          {warning}
        </p>
      )}
      <p>Voucher criado! Anote o código para consultar seu pagamento.</p>
      <h2 className="text-center text-7xl font-bold text-primary-50">{code}</h2>
      {payment_success_url ? (
        <Button asChild className="h-14 bg-positive-green text-xl">
          <Link href={payment_success_url}>Visualizar voucher</Link>
        </Button>
      ) : (
        <Button
          onClick={redirectToPayment}
          className="h-14 bg-positive-green text-xl"
        >
          Finalizar pagamento
        </Button>
      )}
      <Button variant="ghost" onClick={onNewPurchase}>
        Comprar outro voucher
      </Button>
    </div>
  );
}
