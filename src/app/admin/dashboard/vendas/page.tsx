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
import {
  format,
  startOfDay,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  DollarSign,
  LineChart,
  CreditCard,
  ArrowRight,
} from "lucide-react";

// Define Voucher type
type Voucher = {
  id: number;
  name: string;
  phone: string;
  code: string;
  adults: number;
  elderly: number;
  price: number;
  valid: boolean;
  status: string;
  preference_id: string;
  payment_id?: string;
  expires_at?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

// Time period options
const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "thisWeek", label: "Esta Semana" },
  { value: "lastWeek", label: "Semana Passada" },
  { value: "thisMonth", label: "Este Mês" },
  { value: "lastMonth", label: "Mês Passado" },
  { value: "last3Months", label: "Últimos 3 Meses" },
  { value: "thisYear", label: "Este Ano" },
  { value: "lastYear", label: "Ano Passado" },
  { value: "allTime", label: "Desde o início" },
];

export default function SalesPage() {
  // State for period filter
  const [periodFilter, setPeriodFilter] = useState("thisMonth");

  // Get all vouchers
  const { data: allVouchers, isLoading } =
    api.voucher.findAll.useQuery<Voucher[]>();

  // Sanitize vouchers to ensure proper types: converting null values to undefined with explicit type assertion
  const sanitizedVouchers: Voucher[] = allVouchers
    ? allVouchers.map((voucher: any) => ({
        ...voucher,
        payment_id:
          voucher.payment_id === null ? undefined : voucher.payment_id,
        expires_at:
          voucher.expires_at === null ? undefined : voucher.expires_at,
        deletedAt: voucher.deletedAt === null ? undefined : voucher.deletedAt,
      }))
    : [];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  // Get date range based on period filter
  const getDateRange = () => {
    const today = startOfDay(new Date());
    const now = new Date();

    switch (periodFilter) {
      case "today":
        return { from: today, to: now };
      case "yesterday":
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: subDays(now, 1) };
      case "thisWeek":
        const thisWeekStart = subDays(today, today.getDay());
        return { from: thisWeekStart, to: now };
      case "lastWeek":
        const lastWeekStart = subDays(today, today.getDay() + 7);
        const lastWeekEnd = subDays(today, today.getDay() + 1);
        return { from: lastWeekStart, to: lastWeekEnd };
      case "thisMonth":
        return { from: startOfMonth(now), to: now };
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      case "last3Months":
        return { from: subMonths(today, 3), to: now };
      case "thisYear":
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case "lastYear":
        const lastDayLastYear = new Date(
          now.getFullYear() - 1,
          11,
          31,
          23,
          59,
          59,
        );
        const firstDayLastYear = new Date(now.getFullYear() - 1, 0, 1);
        return { from: firstDayLastYear, to: lastDayLastYear };
      case "allTime":
      default:
        return { from: new Date("2020-01-01"), to: now };
    }
  };

  // Filter vouchers based on date range
  const getFilteredVouchers = (): Voucher[] => {
    if (!sanitizedVouchers) return [];

    const dateRange = getDateRange();
    return sanitizedVouchers.filter((voucher) => {
      const voucherDate = new Date(voucher.createdAt);
      return voucherDate >= dateRange.from && voucherDate <= dateRange.to;
    });
  };

  const filteredVouchers = getFilteredVouchers();

  // Calculate metrics
  const totalRevenue = filteredVouchers.reduce(
    (total, v) => total + v.price,
    0,
  );
  const paidVouchers = filteredVouchers.filter((v) => v.payment_id).length;
  const totalVisitors = filteredVouchers.reduce(
    (total, v) => total + v.adults + v.elderly,
    0,
  );

  // Get previous period data for comparison
  const getPreviousPeriodData = () => {
    if (!sanitizedVouchers) return { revenue: 0, vouchers: 0, visitors: 0 };

    const currentRange = getDateRange();
    const periodLength =
      currentRange.to.getTime() - currentRange.from.getTime();

    const previousPeriodEnd = new Date(currentRange.from.getTime() - 1);
    const previousPeriodStart = new Date(
      previousPeriodEnd.getTime() - periodLength,
    );

    const previousVouchers = sanitizedVouchers.filter((voucher) => {
      const voucherDate = new Date(voucher.createdAt);
      return (
        voucherDate >= previousPeriodStart && voucherDate <= previousPeriodEnd
      );
    });

    return {
      revenue: previousVouchers.reduce((total, v) => total + v.price, 0),
      vouchers: previousVouchers.length,
      visitors: previousVouchers.reduce(
        (total, v) => total + v.adults + v.elderly,
        0,
      ),
    };
  };

  const previousPeriod = getPreviousPeriodData();

  // Calculate change percentages
  const revenueChange = previousPeriod.revenue
    ? ((totalRevenue - previousPeriod.revenue) / previousPeriod.revenue) * 100
    : 0;
  const vouchersChange = previousPeriod.vouchers
    ? ((filteredVouchers.length - previousPeriod.vouchers) /
        previousPeriod.vouchers) *
      100
    : 0;
  const visitorsChange = previousPeriod.visitors
    ? ((totalVisitors - previousPeriod.visitors) / previousPeriod.visitors) *
      100
    : 0;

  // Group sales by day
  const salesByDay = filteredVouchers.reduce(
    (acc, voucher) => {
      const day = format(new Date(voucher.createdAt), "yyyy-MM-dd");
      if (!acc[day]) {
        acc[day] = {
          date: new Date(voucher.createdAt),
          revenue: 0,
          vouchers: 0,
          visitors: 0,
          adults: 0,
          elderly: 0,
        };
      }
      acc[day].revenue += voucher.price;
      acc[day].vouchers += 1;
      acc[day].visitors += voucher.adults + voucher.elderly;
      acc[day].adults += voucher.adults;
      acc[day].elderly += voucher.elderly;
      return acc;
    },
    {} as Record<
      string,
      {
        date: Date;
        revenue: number;
        vouchers: number;
        visitors: number;
        adults: number;
        elderly: number;
      }
    >,
  );

  // Convert to array and sort by date
  const dailySalesData = Object.values(salesByDay).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe o desempenho financeiro por período.
        </p>
      </div>

      {/* Period Selector */}
      <div className="mb-6 w-64">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Analytics Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {/* Revenue Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        {/* Vouchers Sold Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vouchers Vendidos
            </CardTitle>
            <CreditCard className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredVouchers.length}</div>
          </CardContent>
        </Card>

        {/* Ticket Average Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <LineChart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredVouchers.length > 0
                ? formatCurrency(totalRevenue / filteredVouchers.length)
                : formatCurrency(0)}
            </div>
            <p className="text-muted-foreground text-xs">
              {paidVouchers} vouchers pagos de {filteredVouchers.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Dia</CardTitle>
          <CardDescription>
            Detalhamento de receita e vouchers por dia no período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vouchers</TableHead>
                  <TableHead>Inteiras</TableHead>
                  <TableHead>Meias</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : dailySalesData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhuma venda encontrada no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySalesData.map((day, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {format(day.date, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{day.vouchers}</TableCell>
                      <TableCell>{day.adults}</TableCell>
                      <TableCell>{day.elderly}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(day.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(day.revenue / day.vouchers)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Summary Row */}
                {dailySalesData.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total no Período</TableCell>
                    <TableCell>{filteredVouchers.length}</TableCell>
                    <TableCell>{totalVisitors}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalRevenue / filteredVouchers.length)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
