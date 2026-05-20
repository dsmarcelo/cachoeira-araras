"use client";

import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

import EmployeeVoucherInfoCard from "../employee-voucher-info-card";
import { formatQuantity } from "@/lib/voucher";
import { getBrazilianDate } from "@/lib/utils/date";
import { api, type RouterOutputs } from "@/trpc/react";

type EmployeeVoucher =
  RouterOutputs["voucher"]["getTodayOperationalVouchers"][number];

function VoucherCard({
  voucher,
  onClick,
}: {
  voucher: EmployeeVoucher;
  onClick: (voucher: EmployeeVoucher) => void;
}) {
  const statusClasses = {
    pending: "border-l-2 border-l-amber-600",
    valid: "border-l-2 border-l-green-600",
  } as const;

  const dynamicClass =
    statusClasses[voucher.status as keyof typeof statusClasses] ?? "";

  return (
    <button
      type="button"
      className={`w-full cursor-pointer px-2 py-2 text-left hover:bg-slate-50 ${dynamicClass}`}
      onClick={() => onClick(voucher)}
    >
      <div className="flex items-center justify-between gap-4">
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
    </button>
  );
}

export default function EmployeeTodayVouchers() {
  const [selectedVoucher, setSelectedVoucher] =
    useState<EmployeeVoucher | null>(null);
  const today = getBrazilianDate();
  const { data: vouchers, isLoading } =
    api.voucher.getTodayOperationalVouchers.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!vouchers?.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-slate-500">Nenhum voucher para hoje</p>
      </div>
    );
  }

  const validVouchers = vouchers.filter((voucher) => voucher.status === "valid");
  const pendingVouchers = vouchers.filter(
    (voucher) => voucher.status === "pending",
  );

  return (
    <div className="w-full rounded-lg border p-4">
      <div className="space-y-8">
        <h2 className="text-center text-xl font-semibold">
          Vouchers para hoje:{" "}
          {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Confirmados ({validVouchers.length})</h3>
          <div className="divide-y">
            {validVouchers.map((voucher) => (
              <VoucherCard
                key={voucher.id}
                voucher={voucher}
                onClick={setSelectedVoucher}
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
                  voucher={voucher}
                  onClick={setSelectedVoucher}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedVoucher && (
        <EmployeeVoucherInfoCard
          data={selectedVoucher}
          open={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}
    </div>
  );
}
