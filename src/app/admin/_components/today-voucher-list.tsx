"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Loader2 } from "lucide-react";

import { getBrazilianDate } from "@/lib/utils/date";
import {
  EmptyState,
  Panel,
  Segmented,
  VoucherStatusBadge,
  countPeople,
  describeEntries,
  type VoucherStatus,
} from "./admin-ui";

type GateVoucher = {
  code: string;
  name: string;
  status: VoucherStatus;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
};

type Filter = "all" | "valid" | "pending";

const filters = [
  { value: "all", label: "Todos" },
  { value: "valid", label: "A entrar" },
  { value: "pending", label: "Pendentes" },
] as const;

/**
 * Today's gate list: headcount stats, a status filter and one row per
 * voucher. Data and the detail drawer come from the caller, since admins and
 * employees read different Convex queries.
 */
export function TodayVoucherList<T extends GateVoucher>({
  vouchers,
  onSelect,
}: {
  vouchers: T[] | undefined;
  onSelect: (voucher: T) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const today = getBrazilianDate();

  if (vouchers === undefined) {
    return (
      <Panel className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </Panel>
    );
  }

  const peopleWhere = (match: (v: T) => boolean) =>
    vouchers.filter(match).reduce((sum, v) => sum + countPeople(v), 0);
  const stats = [
    { label: "Pessoas", value: peopleWhere((v) => v.status !== "pending"), className: "" },
    { label: "Já entraram", value: peopleWhere((v) => v.status === "redeemed"), className: "" },
    {
      label: "Pendentes",
      value: vouchers.filter((v) => v.status === "pending").length,
      className: "text-amber-700",
    },
  ];
  const rows = filter === "all" ? vouchers : vouchers.filter((v) => v.status === filter);

  return (
    <Panel className="flex flex-col">
      <div className="flex flex-col gap-3.5 p-5 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight">Vouchers de hoje</h2>
          <span className="text-[13px] text-muted-foreground">
            {format(today, "EEEE, d MMM", { locale: ptBR })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5 rounded-[10px] bg-muted px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className={`text-xl font-semibold tracking-tight ${stat.className}`}>{stat.value}</span>
            </div>
          ))}
        </div>
        <Segmented value={filter} options={filters} onChange={setFilter} label="Filtrar lista" />
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-border">
          <EmptyState>
            {vouchers.length === 0 ? "Nenhum voucher para hoje." : "Nenhum voucher neste filtro."}
          </EmptyState>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((voucher) => (
            <li key={voucher.code} className="border-t border-border">
              <button
                type="button"
                onClick={() => onSelect(voucher)}
                className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{voucher.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono uppercase tracking-wide">{voucher.code}</span>
                    {" · "}
                    {describeEntries(voucher)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <VoucherStatusBadge status={voucher.status} />
                  <ChevronRight className="size-4 text-zinc-400" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
