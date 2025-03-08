"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  format,
  startOfToday,
  subDays,
  addDays,
  subMonths,
  subWeeks,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, DollarSign, Ticket, Users } from "lucide-react";
import TimeRangeSelector from "@/components/TimeRangeSelector";
import type { Voucher } from "@/types/voucher";

// Date filter options
const dateFilters = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7days", label: "Últimos 7 dias" },
  { value: "last30days", label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

// Status filter options
const statusFilters = [
  { value: "all", label: "Todos" },
  { value: "valid", label: "Válidos" },
  { value: "pending", label: "Pendentes" },
  { value: "used", label: "Utilizados" },
  { value: "expired", label: "Expirados" },
];

export default function DashboardPage() {
  // State for status filter
  const [statusFilter, setStatusFilter] = useState("all");

  // State for search
  const [searchQuery, setSearchQuery] = useState("");

  // Add new state for time range filter
  const [timeRange, setTimeRange] = useState<{
    dateFilter: string;
    customDateRange: { from?: Date; to?: Date };
  }>({ dateFilter: "today", customDateRange: {} });

  // Get all vouchers
  const { data: allVouchers, isLoading } = api.voucher.findAll.useQuery<
    Voucher[]
  >() as { data: Voucher[] | undefined; isLoading: boolean };

  // Get today's vouchers (visitors expected today)
  const { data: todayVouchers } = api.voucher.getTodayVouchers.useQuery<
    Voucher[]
  >() as { data: Voucher[] | undefined };

  // Ensure todayVouchers is an array before processing to avoid unsafe access
  const todayVouchersData: Voucher[] = Array.isArray(todayVouchers)
    ? todayVouchers
    : [];

  // Process the vouchers safely, converting undefined to null as required by the Voucher type
  const filteredTodayVouchers: Voucher[] = todayVouchersData
    .map((voucher: Voucher) => ({
      ...voucher,
      payment_id: voucher.payment_id ?? null,
      expires_at: voucher.expires_at ?? null,
      deletedAt: voucher.deletedAt ?? null,
    }))
    .filter((voucher: Voucher) => voucher.valid && voucher.payment_id !== null);

  // Get valid vouchers
  const { data: validVouchers } = api.voucher.findValid.useQuery();

  // Calculate analytics based on filters
  const getFilteredDateRange = () => {
    const today = startOfToday();

    switch (timeRange.dateFilter) {
      case "today":
        return { from: today, to: addDays(today, 1) };
      case "yesterday":
        return { from: subDays(today, 1), to: today };
      case "last7days":
        // Last 7 days including today
        return { from: subDays(today, 6), to: addDays(today, 1) };
      case "last30days":
        return { from: subDays(today, 29), to: addDays(today, 1) };
      case "thisMonth":
        return {
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: addDays(today, 1),
        };
      case "lastMonth": {
        const firstDayLastMonth = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1,
        );
        const lastDayLastMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          0,
        );
        return { from: firstDayLastMonth, to: addDays(lastDayLastMonth, 1) };
      }
      case "custom":
        return {
          from: timeRange.customDateRange.from ?? today,
          to: timeRange.customDateRange.to ?? addDays(today, 1),
        };
      default:
        return { from: today, to: addDays(today, 1) };
    }
  };

  // Filter vouchers based on current filters
  const filteredVouchers = validVouchers
    ? validVouchers
        .map((voucher) => ({
          ...voucher,
          payment_id: voucher.payment_id ?? undefined,
          expires_at: voucher.expires_at ?? undefined,
          deletedAt: voucher.deletedAt ?? undefined,
        }))
        .filter((voucher) => {
          if (!voucher.expires_at) return false;
          const exp = new Date(voucher.expires_at);
          const { from, to } = getFilteredDateRange();
          return isWithinInterval(exp, { start: from, end: to });
        })
    : [];

  // Calculate metrics
  const calculateTotalRevenue = (vouchers: Voucher[]): number => {
    if (!vouchers || vouchers.length === 0) return 0;
    return vouchers.reduce((total, voucher) => total + voucher.price, 0);
  };

  const calculateTotalVisitors = (vouchers: Voucher[]): number => {
    if (!vouchers || vouchers.length === 0) return 0;
    // Filter vouchers that are confirmed (valid) and paid (payment_id exists)
    const confirmedPaid = vouchers.filter(
      (voucher) => voucher.valid && voucher.payment_id,
    );
    return confirmedPaid.reduce(
      (total, voucher) => total + voucher.adults + voucher.elderly,
      0,
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  return (
    <div className="space-y-4 px-8 py-6">
      <h1 className="mb-6 text-2xl font-bold">Visão Geral</h1>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <TimeRangeSelector onChange={setTimeRange} />
        </div>

        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Input
            placeholder="Buscar por nome, telefone ou código"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="detailed">Detalhado</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Receita Total
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(calculateTotalRevenue(filteredTodayVouchers))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredTodayVouchers.length} vouchers vendidos
                </p>
              </CardContent>
            </Card>

            {/* Total Visitors Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Visitantes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {calculateTotalVisitors(filteredTodayVouchers)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredTodayVouchers.reduce(
                    (total, v: Voucher) => total + v.adults,
                    0,
                  )}{" "}
                  inteiras,{" "}
                  {filteredTodayVouchers.reduce(
                    (total, v: Voucher) => total + v.elderly,
                    0,
                  )}{" "}
                  meias
                </p>
              </CardContent>
            </Card>

            {/* Expected Today Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Esperados Hoje
                </CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {calculateTotalVisitors(filteredTodayVouchers)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredTodayVouchers.length} vouchers para hoje
                </p>
              </CardContent>
            </Card>

            {/* Valid Vouchers Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Vouchers Válidos
                </CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {validVouchers?.length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vouchers disponíveis para uso
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Detailed Table Tab */}
        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Vouchers</CardTitle>
              <CardDescription>
                Lista de todos os vouchers para o período selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <TableHead>Preço</TableHead>
                      <TableHead>Data Criação</TableHead>
                      <TableHead>Validade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredVouchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          Nenhum voucher encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVouchers.map((voucher) => (
                        <TableRow key={voucher.id}>
                          <TableCell>{voucher.code}</TableCell>
                          <TableCell>{voucher.name}</TableCell>
                          <TableCell>{voucher.phone}</TableCell>
                          <TableCell>
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                voucher.status === "valid"
                                  ? "bg-green-100 text-green-800"
                                  : voucher.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : voucher.status === "used"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-red-100 text-red-800"
                              }`}
                            >
                              {voucher.status === "valid"
                                ? "Válido"
                                : voucher.status === "pending"
                                  ? "Pendente"
                                  : voucher.status === "used"
                                    ? "Utilizado"
                                    : "Expirado"}
                            </span>
                          </TableCell>
                          <TableCell>{voucher.adults}</TableCell>
                          <TableCell>{voucher.elderly}</TableCell>
                          <TableCell>{formatCurrency(voucher.price)}</TableCell>
                          <TableCell>
                            {format(new Date(voucher.createdAt), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            {voucher.expires_at
                              ? format(
                                  new Date(voucher.expires_at),
                                  "dd/MM/yyyy",
                                  { locale: ptBR },
                                )
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
              <CardDescription>
                Visualização gráfica dos dados ainda não implementada.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-80 items-center justify-center border-t">
              <p className="text-center text-muted-foreground">
                Os gráficos serão implementados em uma atualização futura.{" "}
                <br />
                Esta área mostrará visualizações dos dados de vouchers ao longo
                do tempo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Voucher details for the filtered date range */}
      <Card>
        <CardHeader>
          {validVouchers && validVouchers.length > 0 ? (
            <>
              <CardTitle>Detalhes dos Vouchers</CardTitle>
              <CardDescription>
                Período:{" "}
                {format(getFilteredDateRange().from, "dd/MM/yyyy", {
                  locale: ptBR,
                })}{" "}
                -{" "}
                {format(getFilteredDateRange().to, "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </CardDescription>
            </>
          ) : (
            <CardTitle>Detalhes dos Vouchers</CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {filteredVouchers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Inteiras</TableHead>
                    <TableHead>Meias</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-medium">
                        {voucher.code}
                      </TableCell>
                      <TableCell>{voucher.name}</TableCell>
                      <TableCell>{voucher.phone}</TableCell>
                      <TableCell>{voucher.adults}</TableCell>
                      <TableCell>{voucher.elderly}</TableCell>
                      <TableCell>{voucher.adults + voucher.elderly}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Válido
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-center text-muted-foreground">
              Nenhum voucher encontrado para o período selecionado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
