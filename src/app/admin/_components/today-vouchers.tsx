"use client";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { GateVoucherInfoCard } from "../gate-voucher-info-card";
import { formatQuantity } from "@/lib/voucher";
import { getBrazilianDate } from "@/lib/utils/date";
import { api } from "../../../../convex/_generated/api";

type AdminGateVoucher = FunctionReturnType<typeof api.vouchers.listTodayAdmin>[number];

function VoucherCard({
  voucher,
  onClick,
}: {
  voucher: AdminGateVoucher;
  onClick: (voucher: AdminGateVoucher) => void;
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
      key={voucher.code}
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
              adults_pool: voucher.adultsPool,
              elderly_pool: voucher.elderlyPool,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TodayVouchers() {
  const [selectedVoucher, setSelectedVoucher] =
    useState<AdminGateVoucher | null>(null);
  const today = getBrazilianDate();
  const vouchers = useQuery(api.vouchers.listTodayAdmin, {});

  if (vouchers === undefined) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!vouchers.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-slate-500">Nenhum voucher para hoje</p>
      </div>
    );
  }

  const paidVouchers = vouchers.filter((v) => v.status === "valid");
  const pendingVouchers = vouchers.filter((v) => v.status === "pending");

  return (
    <div className="w-full border rounded-lg p-4">
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
                key={voucher.code}
                voucher={voucher}
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
                  key={voucher.code}
                  voucher={voucher}
                  onClick={(v) => setSelectedVoucher(v)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedVoucher && (
        <GateVoucherInfoCard
          data={selectedVoucher}
          open={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}
    </div>
  );
}
