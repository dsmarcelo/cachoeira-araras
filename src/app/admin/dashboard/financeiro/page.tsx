"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronRight,
  ReceiptText,
  TicketCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPeriodPreset,
  periodError,
  presetPeriod,
  type Period,
  type PeriodPreset,
} from "@/lib/finance-period";
import { cn } from "@/lib/utils";
import { api } from "../../../../../convex/_generated/api";
import { PeriodPicker } from "./_components/period-picker";
import { RevenueChart } from "./_components/revenue-chart";
import {
  formatCents,
  formatPeriod,
  paymentMethodLabel,
  referrerLabel,
  type FinancialReport,
} from "./format";

const TAB_PRESETS = [
  ["hoje", "Hoje"],
  ["7d", "7 dias"],
  ["mes", "Mês"],
  ["ano", "Ano"],
] as const satisfies ReadonlyArray<readonly [PeriodPreset, string]>;
const DEFAULT_PRESET: PeriodPreset = "7d";

/**
 * Reads the period from the URL: `?periodo=<preset>` or `?de=YYYY-MM-DD&ate=YYYY-MM-DD`.
 * A bad custom range falls back to the default preset and reports why.
 */
function usePeriodFromUrl() {
  const searchParams = useSearchParams();
  const periodo = searchParams.get("periodo");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  if (de !== null || ate !== null) {
    const custom = { from: de ?? "", to: ate ?? "" };
    const error = periodError(custom);
    if (!error) return { preset: null, period: custom, urlError: null };
    return { preset: DEFAULT_PRESET, period: presetPeriod(DEFAULT_PRESET), urlError: error };
  }

  const preset = isPeriodPreset(periodo) ? periodo : DEFAULT_PRESET;
  return { preset, period: presetPeriod(preset), urlError: null };
}

export default function FinanceiroPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { preset, period, urlError } = usePeriodFromUrl();
  const report = useQuery(api.finance.financialReport, period);

  function applyPeriod(next: { preset: PeriodPreset } | { period: Period }) {
    const params = new URLSearchParams(
      "preset" in next ? { periodo: next.preset } : { de: next.period.from, ate: next.period.to },
    );
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 tabular-nums md:gap-6 md:px-8 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Financeiro</h1>
          <p className="hidden text-sm text-muted-foreground md:block">
            Receita dos vouchers vendidos no período.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Tabs
            value={preset ?? ""}
            onValueChange={(value) => isPeriodPreset(value) && applyPeriod({ preset: value })}
          >
            <TabsList className="grid h-11 w-full grid-cols-4 md:w-auto">
              {TAB_PRESETS.map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="h-9 md:px-4">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <PeriodPicker period={period} preset={preset} onApply={applyPeriod} />
        </div>
      </div>

      {urlError && (
        <Alert variant="destructive">
          <AlertDescription>{urlError} Mostrando os últimos 7 dias.</AlertDescription>
        </Alert>
      )}

      {report === undefined ? <ReportSkeleton /> : <Report report={report} />}

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Vouchers de teste não entram em nenhum valor deste relatório.
      </p>
    </div>
  );
}

function Report({ report }: { report: FinancialReport }) {
  const hasPrevious = report.previousNetCents > 0;
  const delta = hasPrevious
    ? ((report.netCents - report.previousNetCents) / report.previousNetCents) * 100
    : 0;
  const up = delta >= 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <Card className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">Receita líquida</span>
              {hasPrevious && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                    up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
                  )}
                >
                  {up ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {up ? "+" : "−"}
                  {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
            <div className="text-3xl font-semibold tracking-tight md:text-4xl">
              {formatCents(report.netCents)}
            </div>
            <div className="text-[13px] text-muted-foreground">
              {hasPrevious
                ? `vs. ${formatCents(report.previousNetCents)} em ${formatPeriod({ from: report.previousFrom, to: report.previousTo })}`
                : `Sem vendas em ${formatPeriod({ from: report.previousFrom, to: report.previousTo })} para comparar`}
            </div>
          </div>
          <RevenueChart
            key={`${report.from}-${report.to}`}
            buckets={report.buckets}
            granularity={report.granularity}
          />
        </Card>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <Kpi label="Vouchers pagos" icon={TicketCheck} value={report.voucherCount.toLocaleString("pt-BR")}>
            pagamento aprovado
          </Kpi>
          <Kpi
            label="Ticket médio"
            icon={ReceiptText}
            value={report.voucherCount > 0 ? formatCents(report.netCents / report.voucherCount) : "—"}
          >
            por voucher
          </Kpi>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Section title="Por origem" description="De onde vieram as vendas">
          {report.referrers.length === 0 ? (
            <Empty />
          ) : (
            report.referrers.map((r) => (
              <Share
                key={r.key}
                label={referrerLabel(r.key)}
                value={formatCents(r.netCents)}
                ratio={r.netCents / report.netCents}
              />
            ))
          )}
        </Section>

        <Section title="Forma de pagamento" description="Como os vouchers foram pagos">
          {report.paymentMethods.length === 0 ? (
            <Empty />
          ) : (
            report.paymentMethods.map((m) => (
              <Share
                key={m.key}
                label={paymentMethodLabel(m.key)}
                value={formatCents(m.netCents)}
                ratio={m.netCents / report.netCents}
              />
            ))
          )}
        </Section>

        <Card className="flex flex-col md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between py-3 pl-5 pr-2">
            <h2 className="text-[15px] font-semibold tracking-tight">Últimas vendas</h2>
            <Link
              href="/admin/tabela"
              className="flex h-11 items-center gap-0.5 rounded-md px-3 text-sm font-medium text-teal-700 hover:bg-muted"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {report.recent.length === 0 ? (
            <div className="border-t px-5 py-6">
              <Empty />
            </div>
          ) : (
            <ul>
              {report.recent.map((sale) => (
                <li
                  key={sale.code}
                  className="flex items-center justify-between gap-3 border-t px-5 py-3.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{sale.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {sale.code} · {format(sale.createdAt, "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold">{formatCents(sale.priceCents)}</span>
                    <StatusBadge status={sale.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Kpi({
  label,
  icon: Icon,
  value,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-[13px] font-medium">{label}</span>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </div>
      <span className="truncate text-2xl font-semibold tracking-tight">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{children}</span>
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

/** A labelled horizontal share bar; `ratio` is 0–1. */
function Share({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const percent = Math.round(ratio * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0">
          <span className="font-semibold">{value}</span>
          <span className="text-muted-foreground"> · {percent}%</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-teal-700" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  valid: ["Válido", "border-green-200 bg-green-50 text-green-700"],
  redeemed: ["Utilizado", "border-border bg-muted text-foreground"],
  expired: ["Expirado", "border-amber-200 bg-amber-50 text-amber-800"],
  refunded: ["Estornado", "border-red-200 bg-red-50 text-red-700"],
  pending: ["Pendente", "border-amber-200 bg-amber-50 text-amber-800"],
  cancelled: ["Cancelado", "border-border bg-muted text-muted-foreground"],
} as const satisfies Record<FinancialReport["recent"][number]["status"], readonly [string, string]>;

function StatusBadge({ status }: { status: keyof typeof STATUS_BADGE }) {
  const [label, className] = STATUS_BADGE[status];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}>
      {label}
    </span>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>;
}

function ReportSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Carregando relatório">
      <Skeleton className="h-80" />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
