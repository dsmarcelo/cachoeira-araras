"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSavedVouchers } from "../../_components/saved-vouchers-provider";
import DeleteVoucherCookieBtn from "../../_components/delete-voucher-cookie-btn";
import type { SavedVoucher } from "@/lib/voucher/browser-storage";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/voucher";
import { formatToBRL } from "@/lib/utils";

const statuses = {
  pending: "Pagamento pendente",
  valid: "Pagamento aprovado",
  redeemed: "Resgatado",
  expired: "Expirado",
  refunded: "Pagamento estornado",
};

/** "2026-09-10" -> "10/09/2026". Formats the date-key string directly instead
 * of routing it through `Date`, which would shift it by a day for a visitor
 * west of UTC. */
function formatVisitDate(visitDate: string) {
  const [year, month, day] = visitDate.split("-");
  return `${day}/${month}/${year}`;
}

function SavedVoucherCard({ entry }: { entry: SavedVoucher }) {
  const voucher = useQuery(api.vouchers.getByCode, { code: entry.code });
  const imageUrl = `/api/og?code=${encodeURIComponent(entry.code)}`;

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-dark-blue p-6">
      <h2 className="text-2xl font-bold">Voucher {entry.code}</h2>
      {voucher === undefined && <p>Consultando pagamento...</p>}
      {voucher === null && <p>Voucher não encontrado</p>}
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
      {voucher?.status === "pending" && entry.initPoint && (
        <Button asChild className="bg-positive-green">
          <a href={entry.initPoint}>Finalizar pagamento</a>
        </Button>
      )}
      {voucher && voucher.status !== "pending" && (
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
