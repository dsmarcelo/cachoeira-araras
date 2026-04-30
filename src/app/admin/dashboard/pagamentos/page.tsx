"use client";

import { useMemo, useState } from "react";
import { Copy, CreditCard, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone, formatToBRL } from "@/lib/utils";
import { api } from "@/trpc/react";

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

const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  in_process: "Em processamento",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Chargeback",
};

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

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatStatus(status: string | null) {
  if (!status) return "—";
  return statusLabels[status] ?? status;
}

function formatMethod(payment: AdminPayment) {
  return [payment.paymentTypeId, payment.paymentMethodId]
    .filter(Boolean)
    .join(" / ") || "—";
}

function getMatchLabel(matchSource: AdminPayment["matchSource"]) {
  if (matchSource === "external_reference") return "Código Mercado Pago";
  if (matchSource === "payment_id") return "Encontrado por payment_id";
  return "Não encontrado no banco";
}

function getMatchClassName(matchSource: AdminPayment["matchSource"]) {
  if (matchSource === "unmatched") return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

async function copyToClipboard(value: string | null) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}

function PaymentDetails({ payment }: { payment: AdminPayment }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Ver detalhes
      </summary>
      <div className="mt-2 grid gap-1 rounded-md bg-muted/50 p-3 text-muted-foreground">
        <span>Status detalhado: {payment.statusDetail ?? "—"}</span>
        <span>Status do voucher no banco: {payment.voucherStatus ?? "—"}</span>
        <span>Valor reembolsado: {formatToBRL(payment.refundedAmount ?? 0)}</span>
        <span>Origem do vínculo: {getMatchLabel(payment.matchSource)}</span>
      </div>
    </details>
  );
}

function CopyButton({ label, value }: { label: string; value: string | null }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      disabled={!value}
      onClick={() => copyToClipboard(value)}
    >
      <Copy className="mr-1 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function PaymentCard({ payment }: { payment: AdminPayment }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg" title={payment.voucherCode ?? "Sem código"}>
              {payment.voucherCode ?? "Sem código"}
            </CardTitle>
            <CardDescription className="truncate" title={payment.paymentId}>
              ID {payment.paymentId}
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
            {formatStatus(payment.status)}
          </span>
        </div>
        <span className={`max-w-full truncate rounded-full px-2 py-1 text-xs font-medium ${getMatchClassName(payment.matchSource)}`}>
          {getMatchLabel(payment.matchSource)}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <span className="text-muted-foreground">Data</span>
          <span className="truncate text-right" title={formatDateTime(payment.dateCreated)}>{formatDateTime(payment.dateCreated)}</span>
          <span className="text-muted-foreground">Valor</span>
          <span className="truncate text-right font-medium">{formatToBRL(payment.transactionAmount ?? 0)}</span>
          <span className="text-muted-foreground">Método</span>
          <span className="truncate text-right" title={formatMethod(payment)}>{formatMethod(payment)}</span>
          <span className="text-muted-foreground">Pagador</span>
          <span className="truncate text-right" title={payment.payerName ?? payment.payerEmail ?? "—"}>
            {payment.payerName ?? payment.payerEmail ?? "—"}
          </span>
          <span className="text-muted-foreground">Telefone</span>
          <span className="truncate text-right">
            {payment.voucherBuyerPhone ? formatPhone(payment.voucherBuyerPhone) : "—"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton label="Copiar ID" value={payment.paymentId} />
          <CopyButton label="Copiar código" value={payment.voucherCode} />
        </div>
        <PaymentDetails payment={payment} />
      </CardContent>
    </Card>
  );
}

export default function AdminPaymentsPage() {
  const [month, setMonth] = useState(getCurrentSaoPauloMonth);
  const [status, setStatus] = useState<PaymentStatus>("approved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ month, page, pageSize, search, status }),
    [month, page, search, status],
  );

  const paymentsQuery = api.mercadopago.listAdminPaymentsByMonth.useQuery(filters);
  const summaryQuery = api.mercadopago.getAdminPaymentsMonthSummary.useQuery({ month });

  const payments = paymentsQuery.data?.items ?? [];
  const pageCount = paymentsQuery.data?.pageCount ?? 0;
  const canGoPrevious = page > 1;
  const canGoNext = pageCount > 0 && page < pageCount;

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pagamentos Mercado Pago</h1>
        <p className="text-muted-foreground">
          Consulte pagamentos por mês e confira o código do voucher vinculado.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados no mês</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryQuery.isLoading
                ? "Carregando..."
                : formatToBRL(summaryQuery.data?.approvedAmount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summaryQuery.data?.approvedCount ?? 0} pagamento(s) aprovado(s)
              {summaryQuery.data?.incomplete
                ? ` — resumo limitado aos primeiros ${summaryQuery.data.scanLimit}`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Registros encontrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentsQuery.data?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {paymentsQuery.data?.searchMode === "current_page"
                ? "Busca ampla filtrando apenas a página carregada."
                : "Total retornado pelo Mercado Pago para os filtros."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-[180px_220px_1fr]">
        <Input
          type="month"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onValueChange={(nextStatus: PaymentStatus) => {
            setStatus(nextStatus);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            maxLength={120}
            placeholder="Buscar ID, código, pagador ou telefone"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {paymentsQuery.isError ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Erro ao carregar pagamentos do Mercado Pago.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:hidden">
        {paymentsQuery.isLoading ? (
          <Card><CardContent className="py-8 text-center">Carregando pagamentos...</CardContent></Card>
        ) : payments.length === 0 ? (
          <Card><CardContent className="py-8 text-center">Nenhum pagamento encontrado.</CardContent></Card>
        ) : (
          payments.map((payment) => <PaymentCard key={payment.paymentId} payment={payment} />)
        )}
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  Carregando pagamentos...
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  Nenhum pagamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.paymentId}>
                  <TableCell className="max-w-32 font-medium">
                    <div className="truncate" title={payment.voucherCode ?? "—"}>{payment.voucherCode ?? "—"}</div>
                    <CopyButton label="Copiar" value={payment.voucherCode} />
                  </TableCell>
                  <TableCell className="max-w-40">
                    <div className="truncate" title={payment.paymentId}>{payment.paymentId}</div>
                    <CopyButton label="Copiar" value={payment.paymentId} />
                  </TableCell>
                  <TableCell>{formatDateTime(payment.dateCreated)}</TableCell>
                  <TableCell>{formatStatus(payment.status)}</TableCell>
                  <TableCell>{formatToBRL(payment.transactionAmount ?? 0)}</TableCell>
                  <TableCell className="max-w-36 truncate" title={formatMethod(payment)}>{formatMethod(payment)}</TableCell>
                  <TableCell className="max-w-56">
                    <div className="truncate" title={payment.payerName ?? payment.payerEmail ?? "—"}>
                      {payment.payerName ?? payment.payerEmail ?? "—"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" title={payment.voucherBuyerPhone ?? undefined}>
                      {payment.voucherBuyerPhone ? formatPhone(payment.voucherBuyerPhone) : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getMatchClassName(payment.matchSource)}`}>
                      {getMatchLabel(payment.matchSource)}
                    </span>
                  </TableCell>
                  <TableCell><PaymentDetails payment={payment} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={!canGoPrevious || paymentsQuery.isFetching}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page} de {Math.max(pageCount, 1)}
        </span>
        <Button
          variant="outline"
          disabled={!canGoNext || paymentsQuery.isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
