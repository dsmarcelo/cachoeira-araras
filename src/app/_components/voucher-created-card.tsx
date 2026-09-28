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
    <div className="flex flex-col gap-6 p-4 text-fg-muted">
      {warning && (
        <p role="alert" className="text-warning-text">
          {warning}
        </p>
      )}
      <p>Voucher criado! Anote o código para consultar seu pagamento.</p>
      <h2 className="text-center text-7xl font-bold text-fg">{code}</h2>
      {payment_success_url ? (
        <Button asChild variant="cta" size="xl" className="h-14">
          <Link href={payment_success_url}>Visualizar voucher</Link>
        </Button>
      ) : (
        <Button
          variant="cta"
          size="xl"
          onClick={redirectToPayment}
          className="h-14"
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
