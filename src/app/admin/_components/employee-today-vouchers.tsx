"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

import EmployeeVoucherInfoCard from "../employee-voucher-info-card";
import { formatQuantity } from "@/lib/voucher";
import { getBrazilianDate } from "@/lib/utils/date";
import { api } from "../../../../convex/_generated/api";

type EmployeeVoucher = FunctionReturnType<typeof api.vouchers.listToday>[number];

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
      className={`w-full cursor-pointer rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 ${dynamicClass}`}
      onClick={() => onClick(voucher)}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{voucher.name}</p>
          <p className="text-base font-mono text-foreground">{voucher.code}</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-muted-foreground">
            {formatQuantity({
              adults: voucher.adults,
              elderly: voucher.elderly,
              adults_pool: voucher.adultsPool,
              elderly_pool: voucher.elderlyPool,
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
  const vouchers = useQuery(api.vouchers.listToday, {});

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
        <p className="text-lg text-muted-foreground">Nenhum voucher para hoje</p>
      </div>
    );
  }

  const validVouchers = vouchers.filter((voucher) => voucher.status === "valid");
  const pendingVouchers = vouchers.filter(
    (voucher) => voucher.status === "pending",
  );

  return (
    <div className="w-full rounded-lg border border-border bg-card text-card-foreground p-4">
      <div className="space-y-8">
        <h2 className="text-center text-xl font-semibold">
          Vouchers para hoje:{" "}
          {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Confirmados ({validVouchers.length})</h3>
          <div className="divide-y divide-border">
            {validVouchers.map((voucher) => (
              <VoucherCard
                key={voucher.code}
                voucher={voucher}
                onClick={setSelectedVoucher}
              />
            ))}
          </div>
        </div>

        {pendingVouchers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-amber-500 dark:text-amber-400">
              Pendentes ({pendingVouchers.length})
            </h3>
            <div className="divide-y divide-border">
              {pendingVouchers.map((voucher) => (
                <VoucherCard
                  key={voucher.code}
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
