"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { getCookieVoucher } from "@/app/lib";
import { api as convexApi } from "../../../../convex/_generated/api";

interface PaymentStatusProps {
  code: string;
  initialCookieVoucher?: { code: string; initPoint: string } | null;
}

/**
 * Reflects a voucher's payment status live, from the same Convex query the
 * voucher purchase form subscribes to. The webhook is the only thing that
 * ever flips `pending` to `valid` (see convex/vouchers.ts confirmPayment);
 * this component just watches for it, so a customer who lands here before
 * their payment clears sees it become valid on its own, without a reload.
 */
export default function PaymentStatus({
  code,
  initialCookieVoucher = null,
}: PaymentStatusProps) {
  const voucher = useQuery(convexApi.vouchers.getByCode, { code });
  const [cookieVoucher, setCookieVoucher] = useState<{
    code: string;
    initPoint: string;
  } | null>(initialCookieVoucher);

  useEffect(() => {
    async function syncCookieVoucher() {
      try {
        const cv = await getCookieVoucher();
        setCookieVoucher(cv);
      } catch {
        // Ignore cookie read failures gracefully.
      }
    }
    void syncCookieVoucher();
  }, []);

  if (voucher === undefined) {
    return (
      <StatusScreen title="Carregando..." description="Um instante." />
    );
  }

  if (voucher === null) {
    return (
      <StatusScreen title="Voucher não encontrado">
        <BackHomeButton />
      </StatusScreen>
    );
  }

  if (voucher.status === "pending") {
    const canRetry = Boolean(
      cookieVoucher?.code === code && cookieVoucher.initPoint,
    );

    return (
      <StatusScreen
        title="Aguardando confirmação do pagamento"
        description="Assim que recebermos a confirmação do Mercado Pago, esta página é atualizada automaticamente — não é necessário atualizar a página."
      >
        <div className="flex flex-col sm:flex-row gap-3 items-center mt-2">
          {canRetry && cookieVoucher ? (
            <Button
              asChild
              className="bg-positive-green hover:bg-positive-green/90 text-primary-50 font-medium"
            >
              <a href={cookieVoucher.initPoint} rel="noopener noreferrer">
                Tentar novamente o pagamento
              </a>
            </Button>
          ) : null}
          <BackHomeButton />
        </div>
      </StatusScreen>
    );
  }

  if (voucher.status === "valid" || voucher.status === "redeemed") {
    return (
      <StatusScreen title="Pagamento aprovado" tone="success">
        <p className="text-primary-100">
          Guarde o código do seu voucher, ele será solicitado na portaria:
        </p>
        <h2 className="text-center text-6xl font-bold text-primary-50">
          {voucher.code}
        </h2>
        <BackHomeButton />
      </StatusScreen>
    );
  }

  // status === "expired"
  return (
    <StatusScreen title="Voucher expirado">
      <p className="text-primary-100">
        Este voucher não é mais válido. Entre em contato para mais
        informações.
      </p>
      <BackHomeButton />
    </StatusScreen>
  );
}

function BackHomeButton() {
  return (
    <Link href="/">
      <Button>Voltar para a página inicial</Button>
    </Link>
  );
}

function StatusScreen({
  title,
  description,
  tone = "neutral",
  children,
}: {
  title: string;
  description?: string;
  tone?: "neutral" | "success";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div
        className={
          tone === "success"
            ? "text-3xl font-bold text-green-500"
            : "text-3xl"
        }
      >
        {title}
      </div>
      {description ? (
        <p className="max-w-md text-primary-300">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
