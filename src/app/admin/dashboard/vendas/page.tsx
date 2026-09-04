"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import DateRangeSelector from "@/app/_components/date-range-selector";
import { api } from "../../../../../convex/_generated/api";
import { getSaoPauloDateKey } from "@/lib/utils/date";
import { formatToBRL } from "@/lib/utils";
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

  // The date range picker works in JS `Date`s; the Convex query wants Sao
  // Paulo calendar-date keys ("YYYY-MM-DD"), the same boundary the gate and
  // admin table already use.
  const { from, to } = useMemo(() => {
    const today = new Date();
    const range =
      fromParam && toParam
        ? { from: new Date(fromParam), to: new Date(toParam) }
        : { from: startOfMonth(today), to: today };

    return {
      from: getSaoPauloDateKey(range.from),
      to: getSaoPauloDateKey(range.to),
    };
  }, [fromParam, toParam]);

  const days = useQuery(api.vouchers.dailyBreakdown, { from, to });
  const isLoading = days === undefined;

  const totals = useMemo(
    () =>
      (days ?? []).reduce(
        (acc, day) => ({
          voucherCount: acc.voucherCount + day.voucherCount,
          revenueCents: acc.revenueCents + day.revenueCents,
          adults: acc.adults + day.adults,
          elderly: acc.elderly + day.elderly,
        }),
        { voucherCount: 0, revenueCents: 0, adults: 0, elderly: 0 },
      ),
    [days],
  );

  const averageTicket =
    totals.voucherCount > 0 ? totals.revenueCents / totals.voucherCount / 100 : 0;

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
              {isLoading ? "Carregando..." : formatToBRL(totals.revenueCents / 100)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vouchers Pagos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.voucherCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatToBRL(averageTicket)}</div>
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
                ) : days.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhuma venda encontrada no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  days.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {format(new Date(`${day.date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{day.voucherCount}</TableCell>
                      <TableCell>{day.adults}</TableCell>
                      <TableCell>{day.elderly}</TableCell>
                      <TableCell className="text-right">
                        {formatToBRL(day.revenueCents / 100)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatToBRL(day.revenueCents / day.voucherCount / 100)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && days.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total no Período</TableCell>
                    <TableCell>{totals.voucherCount}</TableCell>
                    <TableCell>{totals.adults}</TableCell>
                    <TableCell>{totals.elderly}</TableCell>
                    <TableCell className="text-right">
                      {formatToBRL(totals.revenueCents / 100)}
                    </TableCell>
                    <TableCell className="text-right">{formatToBRL(averageTicket)}</TableCell>
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
