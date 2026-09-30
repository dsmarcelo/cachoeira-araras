"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAction, useConvex, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSavedVouchers } from "../../_components/saved-vouchers-provider";
import type { SavedVoucher } from "@/lib/voucher/browser-storage";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { formatQuantity } from "@/lib/voucher";
import { formatToBRL } from "@/lib/utils";
import { useResumePayment } from "@/lib/voucher/use-resume-payment";
import {
  getCachedLookupToken,
  setCachedLookupToken,
} from "@/lib/voucher/lookup-token-cache";

const statuses = {
  pending: "Pagamento pendente",
  valid: "Pagamento aprovado",
  redeemed: "Resgatado",
  expired: "Expirado",
  refunded: "Pagamento estornado",
  cancelled: "Cancelado",
};

/** "2026-09-10" -> "10/09/2026". Formats the date-key string directly instead
 * of routing it through `Date`, which would shift it by a day for a visitor
 * west of UTC. */
function formatVisitDate(visitDate: string) {
  const [year, month, day] = visitDate.split("-");
  return `${day}/${month}/${year}`;
}

function SavedVoucherCard({ entry }: { entry: SavedVoucher }) {
  const { touchEvent } = useSavedVouchers();
  const convex = useConvex();
  const resumePayment = useResumePayment();
  const reconcilePayment = useAction(api.voucherReconciliation.reconcileMine);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const reconciliationAttempted = useRef(false);
  const [lookupToken, setLookupToken] = useState<string | null>(
    () => getCachedLookupToken(entry.code) ?? null,
  );
  const [lookupFailure, setLookupFailure] = useState<
    "not_found" | "rate_limited" | "network" | null
  >(null);
  const voucher = useQuery(
    api.vouchers.getAuthorized,
    lookupToken ? { lookupToken } : "skip",
  );

  useEffect(() => {
    if (
      voucher?.status !== "pending" ||
      !entry.managementToken ||
      reconciliationAttempted.current
    ) return;
    reconciliationAttempted.current = true;
    void reconcilePayment({
      code: entry.code,
      managementToken: entry.managementToken,
    }).catch(() => {
      setReconciliationError(
        "Não foi possível conferir o pagamento agora. Tente novamente em instantes.",
      );
    });
  }, [voucher?.status, entry.code, entry.managementToken, reconcilePayment]);
  const imageUrl = `/api/og?code=${encodeURIComponent(entry.code)}&lookupToken=${encodeURIComponent(lookupToken ?? "")}`;

  // Each saved voucher's own anonymous lookup, spending shared rate-limiter
  // capacity once per card — unless another component already authorized
  // this exact code in this tab (see lookup-token-cache.ts), in which case
  // the cached token above is reused for free. The reactive subscription
  // spends no further capacity either way. See convex/vouchers.ts
  // authorizeLookup.
  useEffect(() => {
    if (lookupToken) return;
    let active = true;
    async function authorize() {
      try {
        const authorization = await convex.mutation(
          api.vouchers.authorizeLookup,
          {
            code: entry.code,
          },
        );
        if (!active) return;
        if (authorization.kind === "authorized") {
          setCachedLookupToken(entry.code, authorization.lookupToken);
          setLookupToken(authorization.lookupToken);
        } else {
          setLookupFailure(authorization.kind);
        }
      } catch {
        // A failed request says nothing about whether the voucher exists.
        if (active) setLookupFailure("network");
      }
    }
    void authorize();
    return () => {
      active = false;
    };
    // lookupToken is read only to decide whether to skip this mount-time
    // authorization, not to react to later changes; including it in the
    // dependency array would re-run the effect (and spend another
    // rate-limited authorizeLookup call) every time it sets the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, entry.code]);

  const refundNotices = useQuery(
    api.refunds.getRefundNoticesForVouchers,
    entry.managementToken
      ? {
          vouchers: [
            { code: entry.code, managementToken: entry.managementToken },
          ],
        }
      : "skip",
  );

  const completedRefundNotices = refundNotices?.filter(
    (notice) => notice.status === "completed",
  );

  useEffect(() => {
    if (!voucher && (!refundNotices || refundNotices.length === 0)) return;

    let eventAt: number | undefined;
    if (refundNotices && refundNotices.length > 0) {
      eventAt = Math.max(...refundNotices.map((n) => n.updatedAt));
    }

    const hasPending =
      refundNotices?.some((n) => n.status !== "completed") ?? false;

    touchEvent(entry.code, {
      eventAt,
      hasPendingRefund: hasPending,
    });
  }, [voucher, refundNotices, entry.code, touchEvent]);

  async function handleResumePayment() {
    if (!entry.managementToken) {
      setResumeError(
        "A autorização desta compra não está disponível neste navegador. Retome o pagamento pelo navegador onde ela foi iniciada ou fale com a nossa equipe.",
      );
      return;
    }
    setIsResuming(true);
    setResumeError(null);
    const message = await resumePayment({
      code: entry.code,
      managementToken: entry.managementToken,
      savedInitPoint: entry.initPoint,
    });
    setResumeError(message);
    setIsResuming(false);
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-surface p-6">
      <h2 className="text-2xl font-bold">Voucher {entry.code}</h2>
      {voucher === undefined && lookupFailure === null && (
        <p>Consultando pagamento...</p>
      )}
      {lookupFailure === "rate_limited" && (
        <p>
          Muitas tentativas de consulta. Aguarde um instante e recarregue a
          página.
        </p>
      )}
      {lookupFailure === "network" && (
        <p role="alert">
          Não foi possível consultar este voucher agora. Confira sua conexão e
          recarregue a página.
        </p>
      )}
      {(voucher === null || lookupFailure === "not_found") && (
        <p>Voucher não encontrado</p>
      )}
      {voucher && (
        <div className="flex flex-col gap-1 text-sm text-fg-subtle">
          <p className="text-base text-fg-muted">
            {statuses[voucher.status]}
          </p>
          <p>Visita: {formatVisitDate(voucher.visitDate)}</p>
          <p>
            {formatQuantity({
              adults: voucher.adults,
              elderly: voucher.elderly,
              adults_pool: voucher.adultsPool,
              elderly_pool: voucher.elderlyPool,
            })}
          </p>
          <p>Valor: {formatToBRL(voucher.priceCents / 100)}</p>
        </div>
      )}
      {completedRefundNotices && completedRefundNotices.length > 0 && (
        <div className="space-y-2">
          {completedRefundNotices.map((notice) => (
            <Notice key={notice.refundId} role="status" tone="success">
              {notice.message}
            </Notice>
          ))}
        </div>
      )}
      {voucher?.status === "pending" && (
        <Button
          variant="cta"
          disabled={isResuming}
          onClick={() => void handleResumePayment()}
        >
          {isResuming ? "Verificando..." : "Finalizar pagamento"}
        </Button>
      )}
      {resumeError && <p role="alert">{resumeError}</p>}
      {reconciliationError && voucher?.status === "pending" && (
        <p role="alert">{reconciliationError}</p>
      )}
      {voucher &&
        (voucher.status === "valid" || voucher.status === "redeemed") && (
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated, non-optimizable OG image */}
            <img
              src={imageUrl}
              alt={`Voucher ${entry.code}`}
              className="w-full rounded-lg"
            />
            <Button asChild variant="outline">
              <a href={imageUrl} download={`voucher-${entry.code}.png`}>
                Baixar imagem
              </a>
            </Button>
          </div>
        )}
    </li>
  );
}

export default function MyVouchersPage() {
  const { vouchers, ready, warning } = useSavedVouchers();
  const router = useRouter();
  useEffect(() => {
    if (ready && vouchers.length === 0) router.replace("/");
  }, [ready, vouchers.length, router]);
  if (!ready || vouchers.length === 0)
    return (
      <main className="bg-page p-6 text-fg-muted">Carregando...</main>
    );
  return (
    <main className="bg-page px-4 py-8 text-fg-muted">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Button
          asChild
          variant="inverseGhost"
          className="-ml-3 w-fit gap-2 text-base"
        >
          <Link href="/">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Meus Vouchers</h1>
        <p>
          Compras iniciadas neste navegador ficam salvas por 2 anos após a
          criação. Limpar os dados do navegador remove este histórico.
        </p>
        {warning && <p role="alert">{warning}</p>}
        <Button asChild variant="brand">
          <Link href="/">Comprar outro voucher</Link>
        </Button>
        <ul className="grid gap-4">
          {vouchers.map((entry) => (
            <SavedVoucherCard key={entry.code} entry={entry} />
          ))}
        </ul>
      </div>
    </main>
  );
}
