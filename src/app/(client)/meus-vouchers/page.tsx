"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSavedVouchers } from "../../_components/saved-vouchers-provider";
import DeleteVoucherCookieBtn from "../../_components/delete-voucher-cookie-btn";
import type { SavedVoucher } from "@/lib/voucher/browser-storage";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/voucher";
import { formatToBRL } from "@/lib/utils";
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
  const convex = useConvex();
  const [lookupToken, setLookupToken] = useState<string | null>(() =>
    getCachedLookupToken(entry.code) ?? null,
  );
  const [lookupFailure, setLookupFailure] = useState<
    "not_found" | "rate_limited" | null
  >(null);
  const voucher = useQuery(
    api.vouchers.getAuthorized,
    lookupToken ? { lookupToken } : "skip",
  );
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
        const authorization = await convex.mutation(api.vouchers.authorizeLookup, {
          code: entry.code,
        });
        if (!active) return;
        if (authorization.kind === "authorized") {
          setCachedLookupToken(entry.code, authorization.lookupToken);
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
    // authorization, not to react to later changes; including it in the
    // dependency array would re-run the effect (and spend another
    // rate-limited authorizeLookup call) every time it sets the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, entry.code]);

  const refundNotices = useQuery(api.refunds.getRefundNoticesForVouchers, {
    voucherCodes: [entry.code],
  });

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-dark-blue p-6">
      <h2 className="text-2xl font-bold">Voucher {entry.code}</h2>
      {voucher === undefined && lookupFailure === null && (
        <p>Consultando pagamento...</p>
      )}
      {lookupFailure === "rate_limited" && (
        <p>Muitas tentativas de consulta. Aguarde um instante e recarregue a página.</p>
      )}
      {(voucher === null || lookupFailure === "not_found") && (
        <p>Voucher não encontrado</p>
      )}
      {voucher && (
        <div className="flex flex-col gap-1 text-sm text-primary-200">
          <p className="text-base text-primary-100">
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
      {refundNotices && refundNotices.length > 0 && (
        <div className="space-y-2">
          {refundNotices.map((notice) => {
            const isCompleted = notice.status === "completed";
            const isNeedsRetry = notice.status === "needs_retry";
            return (
              <div
                key={notice.refundId}
                role="status"
                className={`p-3 rounded-lg border text-sm ${
                  isCompleted
                    ? "bg-green-950/40 border-green-500/40 text-green-200"
                    : isNeedsRetry
                      ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                      : "bg-blue-950/40 border-blue-500/40 text-blue-200"
                }`}
              >
                {notice.message}
              </div>
            );
          })}
        </div>
      )}
      {voucher?.status === "pending" && entry.initPoint && (
        <Button asChild className="bg-positive-green">
          <a href={entry.initPoint}>Finalizar pagamento</a>
        </Button>
      )}
      {voucher && (voucher.status === "valid" || voucher.status === "redeemed") && (
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
      <DeleteVoucherCookieBtn code={entry.code} />
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
      <main className="bg-bg-blue p-6 text-primary-100">Carregando...</main>
    );
  return (
    <main className="bg-bg-blue px-4 py-8 text-primary-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="text-3xl font-bold">Meus Vouchers</h1>
        <p>
          Compras iniciadas neste navegador ficam salvas por 90 dias após a
          criação. Limpar os dados do navegador remove este histórico.
        </p>
        {warning && <p role="alert">{warning}</p>}
        <Button asChild>
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
