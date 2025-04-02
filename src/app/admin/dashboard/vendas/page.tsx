"use client";

import { useSearchParams } from "next/navigation";
import DateRangeSelector from "@/app/_components/date-range-selector";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, LineChart, CreditCard } from "lucide-react";
import { type Voucher } from "@prisma/client";

export default function SalesPage() {
  // Removed local periodFilter state; now using URL params
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRange =
    fromParam && toParam
      ? { from: new Date(fromParam), to: new Date(toParam) }
      : { from: startOfMonth(new Date()), to: new Date() };

  // Get all vouchers
  const { data: allVouchers, isLoading } =
    api.voucher.findAll.useQuery<Voucher[]>();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  // Filter vouchers based on the date range from URL
  const getFilteredVouchers = (): Voucher[] => {
    if (!allVouchers) return [];
    return allVouchers.filter((voucher) => {
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

  const dailySalesData = Object.values(salesByDay).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // After the calculation of totalVisitors, add:
  const totalInteiras = filteredVouchers.reduce(
    (total, v) => total + v.adults,
    0,
  );
  const totalMeias = filteredVouchers.reduce(
    (total, v) => total + v.elderly,
    0,
  );

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe o desempenho financeiro por período.
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="mb-6">
        <DateRangeSelector />
      </div>

      {/* Analytics Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vouchers Vendidos
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredVouchers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredVouchers.length > 0
                ? formatCurrency(totalRevenue / filteredVouchers.length)
                : formatCurrency(0)}
            </div>
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
                    <TableCell>{totalInteiras}</TableCell>
                    <TableCell>{totalMeias}</TableCell>
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
