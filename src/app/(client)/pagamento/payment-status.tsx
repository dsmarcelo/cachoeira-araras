"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConvex, useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { getCookieVoucher } from "@/app/lib";
import { useSavedVouchers } from "@/app/_components/saved-vouchers-provider";
import { api as convexApi } from "../../../../convex/_generated/api";
import {
  getCachedLookupToken,
  setCachedLookupToken,
} from "@/lib/voucher/lookup-token-cache";

interface PaymentStatusProps {
  code: string;
  initialCookieVoucher?: { code: string; initPoint: string } | null;
}

/**
 * Reflects a voucher's payment status live. `code` arrives from the Mercado
 * Pago redirect URL, so it's first exchanged for a rate-limited, opaque
 * `lookupToken` via `authorizeLookup` — the same anonymous lookup gate every
 * other public entry point goes through. The reactive subscription
 * (`getAuthorized`) then spends no further lookup capacity: the webhook is
 * the only thing that ever flips `pending` to `valid` (see
 * convex/vouchers.ts confirmPayment), and this component just watches for
 * it, so a customer who lands here before their payment clears sees it
 * become valid on its own, without a reload.
 */
export default function PaymentStatus({
  code,
  initialCookieVoucher = null,
}: PaymentStatusProps) {
  const convex = useConvex();
  const [lookupToken, setLookupToken] = useState<string | null>(() =>
    getCachedLookupToken(code) ?? null,
  );
  const [lookupFailure, setLookupFailure] = useState<
    "not_found" | "rate_limited" | null
  >(null);
  const voucher = useQuery(
    convexApi.vouchers.getAuthorized,
    lookupToken ? { lookupToken } : "skip",
  );
  const [cookieVoucher, setCookieVoucher] = useState<{
    code: string;
    initPoint: string;
  } | null>(initialCookieVoucher);
  const { vouchers: savedVouchers, ready: savedReady, save, touchEvent } =
    useSavedVouchers();
  const [persistFailed, setPersistFailed] = useState(false);

  useEffect(() => {
    if (lookupToken) return;
    let active = true;
    async function authorize() {
      try {
        const authorization = await convex.mutation(
          convexApi.vouchers.authorizeLookup,
          { code },
        );
        if (!active) return;
        if (authorization.kind === "authorized") {
          setCachedLookupToken(code, authorization.lookupToken);
          setLookupToken(authorization.lookupToken);
        } else {
          setLookupFailure(authorization.kind);
        }
      } catch {
        if (active) setLookupFailure("not_found");
      }
    }
    void authorize();
    return () => {
      active = false;
    };
    // lookupToken is read only to decide whether to skip this mount-time
    // authorization; including it would re-run the effect (and spend
    // another rate-limited authorizeLookup call) as soon as it's set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, convex]);

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

  const isPaid = voucher?.status === "valid" || voucher?.status === "redeemed";
  const hasLocalEntry = savedVouchers.some((entry) => entry.code === code);

  useEffect(() => {
    // A payment confirmed here may reach a browser that never saved this
    // voucher locally (e.g. the checkout happened elsewhere and only the
    // fallback cookie carried the code back). Recover it from the server so
    // "Meus Vouchers" can offer it; if saving fails, fall back to showing
    // the paid voucher's image right here instead.
    if (!isPaid || !savedReady || !voucher) return;
    if (hasLocalEntry) {
      touchEvent(code, { eventAt: Date.now() });
      return;
    }
    const ok = save({
      code,
      initPoint: cookieVoucher?.code === code ? cookieVoucher.initPoint : "",
      createdAt: voucher.createdAt,
      lastFinancialEventAt: Date.now(),
    });
    if (!ok) setPersistFailed(true);
  }, [
    isPaid,
    savedReady,
    hasLocalEntry,
    voucher,
    code,
    cookieVoucher,
    save,
    touchEvent,
  ]);

  if (lookupFailure === "rate_limited") {
    return (
      <StatusScreen
        title="Muitas tentativas"
        description="Aguarde um instante e recarregue a página."
      >
        <BackHomeButton />
      </StatusScreen>
    );
  }

  if (lookupFailure === "not_found" || voucher === null) {
    return (
      <StatusScreen title="Voucher não encontrado">
        <BackHomeButton />
      </StatusScreen>
    );
  }

  if (voucher === undefined) {
    return (
      <StatusScreen title="Carregando..." description="Um instante." />
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
        {savedReady && hasLocalEntry && (
          <Button asChild>
            <Link href="/meus-vouchers">Ver em Meus Vouchers</Link>
          </Button>
        )}
        {savedReady && !hasLocalEntry && persistFailed && (
          <div className="flex w-full max-w-md flex-col gap-3">
            <p role="alert" className="text-orange-100">
              Não foi possível salvar este voucher neste navegador. Anote o
              código antes de sair — a imagem abaixo fica disponível apenas
              nesta página.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated, non-optimizable OG image */}
            <img
              src={`/api/og?code=${encodeURIComponent(voucher.code)}&lookupToken=${encodeURIComponent(lookupToken ?? "")}`}
              alt={`Voucher ${voucher.code}`}
              className="w-full rounded-lg"
            />
          </div>
        )}
        <BackHomeButton />
      </StatusScreen>
    );
  }

  if (voucher.status === "refunded") {
    return (
      <StatusScreen title="Pagamento estornado">
        <p className="text-primary-100">
          O pagamento deste voucher foi estornado, cancelado ou contestado.
          Entre em contato para mais informações.
        </p>
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 bg-bg-blue px-4 py-8 text-center md:min-h-[calc(100vh-6rem)]">
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
