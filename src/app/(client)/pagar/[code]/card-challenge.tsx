"use client";

import { useState } from "react";
import { StatusScreen } from "@mercadopago/sdk-react";

import { capturePaymentFlowException } from "@/lib/sentry/payment";

/**
 * Bank authentication (3DS) of a card charge, started as soon as the provider
 * asks for it. The Status Screen Brick only carries the buyer through the
 * bank's challenge: the payment counts as approved only after the server
 * confirms it, so this never announces a result.
 */
export function CardChallenge({
  code,
  paymentId,
  challenge,
}: {
  code: string;
  paymentId: string;
  challenge: { externalResourceUrl: string; creq: string };
}) {
  const [failed, setFailed] = useState(false);
  return (
    <section
      aria-label="Verificação do banco"
      className="grid gap-3 rounded-xl border border-line-soft bg-surface-alt p-4 text-fg"
    >
      <h2 className="text-lg font-bold">Confirme o pagamento com seu banco</h2>
      <p role="status">
        Seu banco pede uma verificação de segurança. Conclua-a abaixo para
        finalizar o pagamento e não feche esta página. O pagamento só é aprovado
        depois dessa verificação.
      </p>
      {failed && (
        <p role="alert" className="text-warning-text">
          Não foi possível abrir a verificação do banco. Se ela não for
          concluída em alguns minutos, o pagamento não será aprovado e você
          poderá tentar novamente com o mesmo voucher.
        </p>
      )}
      <StatusScreen
        locale="pt-BR"
        initialization={{
          paymentId,
          additionalInfo: {
            externalResourceURL: challenge.externalResourceUrl,
            creq: challenge.creq,
          },
        }}
        onError={(error) => {
          capturePaymentFlowException(error, "three_ds_challenge", { code });
          setFailed(true);
        }}
      />
    </section>
  );
}
