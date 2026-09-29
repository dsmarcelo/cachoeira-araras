"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Check, ChevronLeft, ChevronRight, Copy, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPhone, formatToBRL, getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import {
  ChipGroup,
  EmptyState,
  PageShell,
  Pager,
  Panel,
  SearchInput,
  StatusBadge,
  type Tone,
} from "../../_components/admin-ui";

type PaymentStatus =
  | "all"
  | "approved"
  | "pending"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

type AdminPayment = {
  paymentId: string;
  voucherCode: string | null;
  dateCreated: string | null;
  status: string | null;
  statusDetail: string | null;
  transactionAmount: number | null;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  payerName: string | null;
  payerEmail: string | null;
  voucherBuyerName: string | null;
  voucherBuyerPhone: string | null;
  voucherStatus: string | null;
  matchSource: "external_reference" | "payment_id" | "unmatched";
  refundedAmount: number | null;
};

const pageSize = 25;

const statusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "approved", label: "Aprovados" },
  { value: "pending", label: "Pendentes" },
  { value: "in_process", label: "Em processamento" },
  { value: "rejected", label: "Rejeitados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "refunded", label: "Reembolsados" },
  { value: "charged_back", label: "Chargeback" },
];

const statusLabels: Record<string, { label: string; tone: Tone }> = {
  approved: { label: "Aprovado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  in_process: { label: "Em processamento", tone: "warning" },
  rejected: { label: "Rejeitado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  refunded: { label: "Reembolsado", tone: "neutral" },
  charged_back: { label: "Chargeback", tone: "danger" },
};

const monthArrowClass =
  "flex size-11 items-center justify-center rounded-lg border border-border bg-white shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-40";

function getCurrentSaoPauloMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year ?? new Date().getFullYear()}-${month ?? "01"}`;
}

/** Shifts a "YYYY-MM" key by `delta` months. */
function shiftMonth(month: string, delta: number) {
  const [year = 1970, monthNumber = 1] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "Setembro 2026". */
function formatMonthLabel(month: string) {
  const [year = 1970, monthNumber = 1] = month.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(year, monthNumber - 1, 1),
  );
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatMethod(payment: AdminPayment) {
  return (
    [payment.paymentTypeId, payment.paymentMethodId]
      .filter(Boolean)
      .join(" / ") || "—"
  );
}

function getMatchLabel(matchSource: AdminPayment["matchSource"]) {
  if (matchSource === "external_reference") return "Código Mercado Pago";
  if (matchSource === "payment_id") return "Encontrado por payment_id";
  return "Não encontrado no banco";
}

/** Outlined "Copiar …" button that confirms with a check for a moment. */
function CopyTextButton({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  return (
    <button
      type="button"
      disabled={!value}
      onClick={() => void handleCopy()}
      className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-[13px] font-medium transition-colors hover:bg-zinc-50 disabled:opacity-45"
    >
      {copied ? (
        <Check className="size-3.5 text-green-700" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copiado" : label}
    </button>
  );
}

function PaymentDetails({ payment }: { payment: AdminPayment }) {
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Ver detalhes
      </summary>
      <div className="mt-2 grid gap-1 rounded-lg bg-muted p-3 text-zinc-600">
        <span>Status detalhado: {payment.statusDetail ?? "—"}</span>
        <span>Status do voucher no banco: {payment.voucherStatus ?? "—"}</span>
        <span>
          Valor reembolsado: {formatToBRL(payment.refundedAmount ?? 0)}
        </span>
      </div>
    </details>
  );
}

function PaymentCard({ payment }: { payment: AdminPayment }) {
  const status = payment.status ? statusLabels[payment.status] : undefined;
  const payer = payment.payerName ?? payment.payerEmail ?? "—";

  return (
    <Panel as="article" className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={`truncate font-mono text-base font-semibold uppercase tracking-wide ${payment.voucherCode ? "" : "text-muted-foreground"}`}
          >
            {payment.voucherCode ?? "Sem código"}
          </span>
          <span className="truncate text-xs text-muted-foreground" title={payment.paymentId}>
            ID {payment.paymentId}
          </span>
        </div>
        <StatusBadge tone={status?.tone ?? "neutral"}>
          {status?.label ?? payment.status ?? "—"}
        </StatusBadge>
      </div>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3">
        <span className="text-[22px] font-semibold tracking-tight">
          {formatToBRL(payment.transactionAmount ?? 0)}
        </span>
        <span className="truncate text-[13px] text-muted-foreground" title={formatMethod(payment)}>
          {formatMethod(payment)}
        </span>
      </div>
      <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border px-4 py-3 text-[13px]">
        <dt className="text-muted-foreground">Data</dt>
        <dd className="text-right">{formatDateTime(payment.dateCreated)}</dd>
        <dt className="text-muted-foreground">Pagador</dt>
        <dd className="truncate text-right" title={payer}>
          {payer}
        </dd>
        <dt className="text-muted-foreground">Telefone</dt>
        <dd className="text-right">
          {payment.voucherBuyerPhone ? formatPhone(payment.voucherBuyerPhone) : "—"}
        </dd>
        <dt className="text-muted-foreground">Vínculo</dt>
        <dd className="flex justify-end">
          <StatusBadge tone={payment.matchSource === "unmatched" ? "warning" : "success"}>
            {getMatchLabel(payment.matchSource)}
          </StatusBadge>
        </dd>
      </dl>
      <div className="border-t border-border px-4 py-3">
        <PaymentDetails payment={payment} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border px-4 pb-4 pt-3">
        <CopyTextButton label="Copiar ID" value={payment.paymentId} />
        <CopyTextButton label="Copiar código" value={payment.voucherCode} />
      </div>
    </Panel>
  );
}

export default function AdminPaymentsPage() {
  const refundAlerts = useQuery(api.refunds.listOperationalAlerts);
  const retryRefund = useAction(api.refunds.retryAdminRefund);
  const [retryingRefundId, setRetryingRefundId] = useState<string | null>(null);

  async function handleRetryRefund(id: NonNullable<NonNullable<typeof refundAlerts>[number]["refundId"]>) {
    setRetryingRefundId(id);
    try {
      const result = await retryRefund({ id });
      toast({
        title: result === "completed" ? "Reembolso confirmado" : "Nova tentativa solicitada",
        description: result === "completed"
          ? "O Mercado Pago já havia devolvido o valor integral."
          : "Acompanhe o andamento nesta página.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível tentar novamente",
        description: getErrorMessage(error, "Confira o pagamento no Mercado Pago."),
        variant: "destructive",
      });
    } finally {
      setRetryingRefundId(null);
    }
  }
  const [month, setMonth] = useState(getCurrentSaoPauloMonth);
  const [status, setStatus] = useState<PaymentStatus>("approved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ month, page, pageSize, search, status }),
    [month, page, search, status],
  );

  const listAdminPayments = useAction(api.mercadopago.listAdminPaymentsByMonth);
  const getAdminPaymentsMonthSummary = useAction(
    api.mercadopago.getAdminPaymentsMonthSummary,
  );

  const [paymentsQuery, setPaymentsQuery] = useState<{
    data: {
      items: AdminPayment[];
      page: number;
      pageCount: number;
      pageSize: number;
      searchMode: "exact_payment_id" | "current_page" | "mercado_pago";
      total: number;
    } | null;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
  }>({
    data: null,
    isLoading: true,
    isFetching: false,
    isError: false,
  });

  const [summaryQuery, setSummaryQuery] = useState<{
    data: {
      approvedAmount: number;
      approvedCount: number;
      incomplete: boolean;
      scanLimit: number;
    } | null;
    isLoading: boolean;
    isError: boolean;
  }>({
    data: null,
    isLoading: true,
    isError: false,
  });

  useEffect(() => {
    let cancelled = false;
    setPaymentsQuery((prev) => ({
      ...prev,
      isLoading: !prev.data,
      isFetching: true,
      isError: false,
    }));

    listAdminPayments(filters)
      .then((data) => {
        if (cancelled) return;
        setPaymentsQuery({
          data,
          isLoading: false,
          isFetching: false,
          isError: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPaymentsQuery((prev) => ({
          ...prev,
          isLoading: false,
          isFetching: false,
          isError: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [filters, listAdminPayments]);

  useEffect(() => {
    let cancelled = false;
    setSummaryQuery((prev) => ({
      ...prev,
      isLoading: !prev.data,
      isError: false,
    }));

    getAdminPaymentsMonthSummary({ month })
      .then((data) => {
        if (cancelled) return;
        setSummaryQuery({
          data,
          isLoading: false,
          isError: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSummaryQuery((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [month, getAdminPaymentsMonthSummary]);

  const payments = paymentsQuery.data?.items ?? [];
  const pageCount = paymentsQuery.data?.pageCount ?? 0;
  const currentMonth = getCurrentSaoPauloMonth();

  function changeMonth(delta: number) {
    setMonth((current) => shiftMonth(current, delta));
    setPage(1);
  }

  return (
    <PageShell className="md:max-w-5xl">
      {refundAlerts && refundAlerts.length > 0 ? (
        <Panel className="flex flex-col gap-3 border-red-200 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-red-700">
              Reembolsos que precisam de acompanhamento
            </h2>
            <p className="text-[13px] text-muted-foreground">
              O Mercado Pago falhou repetidamente. Confirme o reembolso e entre
              em contato com o cliente se necessário.
            </p>
          </div>
          {refundAlerts.map((alert) => (
            <div
              key={alert.id}
              role="alert"
              className="flex flex-col gap-1 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm"
            >
              <p className="font-medium">
                Voucher <span className="font-mono uppercase">{alert.voucherCode}</span>
              </p>
              <p className="text-zinc-700">
                {alert.customerName} · {formatPhone(alert.customerPhone)} · {alert.attemptCount} tentativas
              </p>
              <p className="text-red-700">Última falha: {alert.explanation}</p>
              {alert.providerDetail && (
                <p className="text-xs text-muted-foreground">Detalhe técnico: {alert.providerDetail}</p>
              )}
              {alert.needsAttention ? (
                <div className="mt-1 flex flex-col items-start gap-2">
                  <p className="font-medium text-red-700">Tentativas automáticas pausadas.</p>
                  {alert.refundId && (
                    <Button
                      variant="outline"
                      className="h-10"
                      disabled={retryingRefundId !== null}
                      onClick={() => void handleRetryRefund(alert.refundId!)}
                    >
                      {retryingRefundId === alert.refundId ? "Verificando..." : "Tentar reembolso novamente"}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </Panel>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mês anterior"
          className={monthArrowClass}
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="text-[15px] font-semibold">{formatMonthLabel(month)}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          className={monthArrowClass}
          disabled={month >= currentMonth}
          onClick={() => changeMonth(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <Panel className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted-foreground">Aprovados no mês</span>
          <span className="text-2xl font-semibold tracking-tight">
            {summaryQuery.isLoading
              ? "Carregando..."
              : summaryQuery.isError
                ? "—"
                : formatToBRL(summaryQuery.data?.approvedAmount ?? 0)}
          </span>
          <span className="text-xs text-muted-foreground">
            {summaryQuery.isError
              ? "Não foi possível carregar o resumo do mês."
              : `${summaryQuery.data?.approvedCount ?? 0} pagamento(s) aprovado(s)${
                  summaryQuery.data?.incomplete
                    ? ` — resumo limitado aos primeiros ${summaryQuery.data.scanLimit}`
                    : ""
                }`}
          </span>
        </div>
        <CreditCard className="size-5 text-muted-foreground" aria-hidden />
      </Panel>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar ID, código, pagador ou telefone"
      />
      <ChipGroup
        value={status}
        options={statusOptions}
        onChange={(nextStatus) => {
          setStatus(nextStatus);
          setPage(1);
        }}
        label="Status"
      />

      <p className="px-1 pt-1 text-[13px] text-muted-foreground">
        {paymentsQuery.data?.total ?? 0} pagamento(s) encontrado(s)
        {paymentsQuery.data?.searchMode === "current_page"
          ? " — busca ampla filtrando apenas a página carregada"
          : ""}
      </p>

      {paymentsQuery.isError ? (
        <Panel>
          <EmptyState tone="error">
            Não foi possível carregar os pagamentos do Mercado Pago. Tente novamente em instantes.
          </EmptyState>
        </Panel>
      ) : paymentsQuery.isLoading ? (
        <Panel>
          <EmptyState>Carregando pagamentos...</EmptyState>
        </Panel>
      ) : payments.length === 0 ? (
        <Panel>
          <EmptyState>Nenhum pagamento encontrado.</EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {payments.map((payment) => (
            <PaymentCard key={payment.paymentId} payment={payment} />
          ))}
        </div>
      )}

      <Pager
        page={page}
        pageCount={pageCount}
        disabled={paymentsQuery.isFetching}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
