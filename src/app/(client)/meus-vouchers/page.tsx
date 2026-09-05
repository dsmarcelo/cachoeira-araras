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

function SavedVoucherCard({ entry }: { entry: SavedVoucher }) {
  const voucher = useQuery(api.vouchers.getByCode, { code: entry.code });
  const statuses = {
    pending: "Pagamento pendente",
    valid: "Pagamento aprovado",
    redeemed: "Resgatado",
    expired: "Expirado",
  };
  return (
    <li className="flex flex-col gap-4 rounded-xl bg-dark-blue p-6">
      <h2 className="text-2xl font-bold">Voucher {entry.code}</h2>
      <p>
        {voucher === undefined
          ? "Consultando pagamento..."
          : voucher === null
            ? "Voucher não encontrado"
            : statuses[voucher.status]}
      </p>
      {voucher?.status === "pending" && entry.initPoint && (
        <Button asChild className="bg-positive-green">
          <a href={entry.initPoint}>Finalizar pagamento</a>
        </Button>
      )}
      {voucher && (
        <Link
          className="underline"
          href={`/pagamento?external_reference=${encodeURIComponent(entry.code)}`}
        >
          Consultar voucher
        </Link>
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
