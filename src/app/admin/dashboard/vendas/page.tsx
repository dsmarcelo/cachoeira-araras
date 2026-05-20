"use client";

import { useMemo } from "react";
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

export default function SalesPage() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRange = useMemo(() => {
    const today = new Date();

    return fromParam && toParam
      ? { from: new Date(fromParam), to: new Date(toParam) }
      : { from: startOfMonth(today), to: today };
  }, [fromParam, toParam]);

  const { data: salesSummary, isLoading } = api.voucher.getAdminSalesSummary.useQuery({
    from: dateRange.from,
    to: dateRange.to,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const dailySalesData = salesSummary?.dailySalesData ?? [];
  const totalRevenue = salesSummary?.totalRevenue ?? 0;
  const paidCount = salesSummary?.paidCount ?? 0;
  const totalInteiras = salesSummary?.totalInteiras ?? 0;
  const totalMeias = salesSummary?.totalMeias ?? 0;

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe o desempenho financeiro por período.
        </p>
      </div>

      <div className="mb-6">
        <DateRangeSelector />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "Carregando..." : formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vouchers Pagos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(salesSummary?.averageTicket ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <TableCell colSpan={6} className="h-24 text-center">
                      Carregando vendas...
                    </TableCell>
                  </TableRow>
                ) : dailySalesData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhuma venda encontrada no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySalesData.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {format(new Date(`${day.date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
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
                {dailySalesData.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total no Período</TableCell>
                    <TableCell>{paidCount}</TableCell>
                    <TableCell>{totalInteiras}</TableCell>
                    <TableCell>{totalMeias}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(paidCount > 0 ? totalRevenue / paidCount : 0)}
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
