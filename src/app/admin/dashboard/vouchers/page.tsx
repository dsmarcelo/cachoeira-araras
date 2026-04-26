"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Clock,
  DollarSign,
  Filter,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/utils";
import { useSearchParams } from "next/navigation";
import { startOfMonth } from "date-fns";
import DateRangeSelector from "@/app/_components/date-range-selector";

const statusOptions = [
  { value: "all", label: "Todos os Status" },
  { value: "valid", label: "Válidos" },
  { value: "pending", label: "Pendentes" },
  { value: "redeemed", label: "Utilizados" },
  { value: "expired", label: "Expirados" },
];

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRange = useMemo(() => {
    const today = new Date();

    return fromParam && toParam
      ? { from: new Date(fromParam), to: new Date(toParam) }
      : { from: startOfMonth(today), to: today };
  }, [fromParam, toParam]);

  const queryFilters = useMemo(() => ({
    status: statusFilter,
    search: searchQuery,
    from: dateRange.from,
    to: dateRange.to,
  }), [dateRange.from, dateRange.to, searchQuery, statusFilter]);

  const { data: vouchersPage, isLoading: isLoadingVouchers } =
    api.voucher.findAdminPage.useQuery({
      ...queryFilters,
      page,
      pageSize,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

  const { data: summary, isLoading: isLoadingSummary } =
    api.voucher.getAdminVoucherSummary.useQuery(queryFilters);

  const formatDate = (date: Date) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSearchChange = (search: string) => {
    setSearchQuery(search);
    setPage(1);
  };

  const vouchers = vouchersPage?.items ?? [];
  const pageCount = vouchersPage?.pageCount ?? 1;
  const canPreviousPage = page > 1;
  const canNextPage = page < pageCount;

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciamento de Vouchers</h1>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      <div className="mb-6">
        <DateRangeSelector />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou código"
            className="pl-8"
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por status" />
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
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingSummary ? "Carregando..." : formatCurrency(summary?.totalSales ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.paidCount ?? 0} vouchers pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status dos Vouchers</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-xs">Válidos: {summary?.statusCounts.valid ?? 0}</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-yellow-500"></span>
                  <span className="text-xs">Pendentes: {summary?.statusCounts.pending ?? 0}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-blue-500"></span>
                  <span className="text-xs">Utilizados: {summary?.statusCounts.redeemed ?? 0}</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
                  <span className="text-xs">Expirados: {summary?.statusCounts.expired ?? 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitantes</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.visitorsCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalAdults ?? 0} inteiras, {summary?.totalElderly ?? 0} meias, {summary?.totalAdultsPool ?? 0} inteiras (piscina), {summary?.totalElderlyPool ?? 0} meias (piscina)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Voucher</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.averageVoucherValue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(summary?.averagePeoplePerVoucher ?? 0).toFixed(1)} pessoas/voucher
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Vouchers ({vouchersPage?.total ?? 0})</CardTitle>
          <CardDescription>Gerencie todos os vouchers do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inteiras</TableHead>
                  <TableHead>Meias</TableHead>
                  <TableHead>Inteiras (Piscina)</TableHead>
                  <TableHead>Meias (Piscina)</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingVouchers ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center">
                      Carregando vouchers...
                    </TableCell>
                  </TableRow>
                ) : vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center">
                      Nenhum voucher encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  vouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-medium">{voucher.code}</TableCell>
                      <TableCell>{voucher.name}</TableCell>
                      <TableCell>{formatPhone(voucher.phone)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${voucher.status === "valid"
                            ? "bg-green-100 text-green-800"
                            : voucher.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : voucher.status === "redeemed" || voucher.status === "used"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            }`}
                        >
                          {voucher.status === "valid" && <Check className="mr-1 h-3 w-3" />}
                          {voucher.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                          {(voucher.status === "redeemed" || voucher.status === "used") && <Check className="mr-1 h-3 w-3" />}
                          {voucher.status === "expired" && <X className="mr-1 h-3 w-3" />}
                          {voucher.status === "valid"
                            ? "Válido"
                            : voucher.status === "pending"
                              ? "Pendente"
                              : voucher.status === "redeemed" || voucher.status === "used"
                                ? "Utilizado"
                                : "Expirado"}
                        </span>
                      </TableCell>
                      <TableCell>{voucher.adults}</TableCell>
                      <TableCell>{voucher.elderly}</TableCell>
                      <TableCell>{voucher.adults_pool || 0}</TableCell>
                      <TableCell>{voucher.elderly_pool || 0}</TableCell>
                      <TableCell>{formatCurrency(voucher.price)}</TableCell>
                      <TableCell>{formatDate(voucher.createdAt)}</TableCell>
                      <TableCell>{voucher.expires_at ? formatDate(voucher.expires_at) : "N/A"}</TableCell>
                      <TableCell>
                        {voucher.payment_id ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                            <Check className="mr-1 h-3 w-3" />
                            Confirmado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                            <Clock className="mr-1 h-3 w-3" />
                            Pendente
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Página {page} de {pageCount}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={!canPreviousPage}>
              Primeira
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={!canPreviousPage}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!canNextPage}>
              Próxima
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(pageCount)} disabled={!canNextPage}>
              Última
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
