"use client";
import { useTodayVoucherPage } from "@/hooks/use-vouchers";
import { getBrazilianDate } from "@/lib/utils/date";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { VoucherInfoCard } from "../voucher-info-card";
import type { CompleteVoucherSchema } from "@/lib/voucher/types";
import { formatQuantity } from "@/lib/voucher";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import VoucherPageControls from "./voucher-page-controls";
import { Button } from "@/components/ui/button";

function VoucherCard({
  voucher,
  onClick,
}: {
  voucher: CompleteVoucherSchema;
  onClick: (voucher: CompleteVoucherSchema) => void;
}) {
  const statusClasses = {
    valid: "border-l-2 border-l-green-600",
    pending: "border-l-2 border-l-amber-600",
    expired: "border-l-2 border-l-red-600",
  } as const;

  const dynamicClass =
    statusClasses[voucher.status as keyof typeof statusClasses] ?? "";

  return (
    <div
      key={voucher.id}
      className={`cursor-pointer px-2 py-2 hover:bg-slate-50 ${dynamicClass}`}
      onClick={() => onClick(voucher)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{voucher.name}</p>
          <p className="text-base text-black">{voucher.code}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">
            {formatQuantity({
              adults: voucher.adults,
              elderly: voucher.elderly,
              adults_pool: voucher.adults_pool,
              elderly_pool: voucher.elderly_pool,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TodayVouchers() {
  const [selectedVoucher, setSelectedVoucher] =
    useState<CompleteVoucherSchema | null>(null);
  const today = getBrazilianDate();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refresh } = useTodayVoucherPage({ page, pageSize: 10 });
  const vouchers = data?.items;
  const selectedData = vouchers?.find((voucher) => voucher.id === selectedVoucher?.id) ?? selectedVoucher;

  if (isLoading) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) return <p role="alert">Erro ao carregar vouchers. <Button onClick={() => void refresh()}>Tentar novamente</Button></p>;


  const paidVouchers = (vouchers ?? []).filter((v) => v.status === "valid");
  const pendingVouchers = (vouchers ?? []).filter((v) => v.status === "pending");

  return (
    <div className="w-full border rounded-lg p-4">
      {data?.syncWarning && <p role="alert">{data.syncWarning} <Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></p>}
      {!vouchers?.length && <p className="text-center">Nenhum voucher nesta página.</p>}
      <div className="space-y-8">
        <h2 className="text-center text-xl font-semibold">
          Vouchers para hoje: {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Confirmados ({paidVouchers.length})
          </h3>
          <div className="divide-y">
            {paidVouchers.map((voucher) => (
              <VoucherCard
                key={voucher.id}
                voucher={{
                  ...voucher,
                  payment_id: voucher.payment_id ?? undefined,
                }}
                onClick={(v) => setSelectedVoucher(v)}
              />
            ))}
          </div>
        </div>

        {pendingVouchers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-amber-600">
              Pendentes ({pendingVouchers.length})
            </h3>
            <div className="divide-y">
              {pendingVouchers.map((voucher) => (
                <VoucherCard
                  key={voucher.id}
                  voucher={{
                    ...voucher,
                    payment_id: voucher.payment_id ?? undefined,
                  }}
                  onClick={(v) => setSelectedVoucher(v)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <VoucherPageControls page={page} pageCount={data?.pageCount ?? 1} onPageChange={setPage} />
      {selectedData && (
        <VoucherInfoCard
          data={{ ...selectedData, payment_id: selectedData.payment_id ?? undefined }}
          open={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          canEditVisitDate
        />
      )}
    </div>
  );
}
