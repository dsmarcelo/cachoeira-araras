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
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfToday, subDays, subMonths, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  CreditCard,
  DollarSign,
  Filter,
  Search,
} from "lucide-react";
import { formatPaymentType } from "@/lib/mercadopago";

// Define Voucher with payment details type
type VoucherWithPayment = {
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
  paymentDetails: {
    method_id: string;
    method_name: string;
  };
};

// Payment method type for aggregated data
type PaymentMethodStat = {
  method: string;
  count: number;
  revenue: number;
  methodDisplayName: string;
};

export default function PaymentMethodsPage() {
  // State for date filtering
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // State for search query
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch vouchers with payment details using our new endpoint
  const { data: vouchersWithPayment, isLoading } =
    api.payment.getPaymentMethods.useQuery(
      dateRange.from && dateRange.to
        ? {
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
          }
        : undefined,
      {
        // Atualiza ao mudar o intervalo de datas
        enabled: true,
      },
    );

  // Format date for display
  const formatDate = (date: Date) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  // Get filtered vouchers based on search
  const getFilteredVouchers = (): VoucherWithPayment[] => {
    if (!vouchersWithPayment) return [];

    return (vouchersWithPayment as VoucherWithPayment[]).filter((voucher) => {
      // Search filter - search by payment method
      const paymentMethod = voucher.paymentDetails.method_id || "";
      const paymentMethodDisplay = formatPaymentType(paymentMethod);

      const matchesSearch = !searchQuery
        ? true
        : paymentMethodDisplay
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  };

  const filteredVouchers = getFilteredVouchers();

  // Group vouchers by payment method
  const paymentMethods: PaymentMethodStat[] = filteredVouchers.reduce(
    (acc: PaymentMethodStat[], voucher) => {
      const method = voucher.paymentDetails.method_id;
      const existingMethod = acc.find((m) => m.method === method);

      if (existingMethod) {
        existingMethod.count += 1;
        existingMethod.revenue += voucher.price;
      } else {
        acc.push({
          method,
          count: 1,
          revenue: voucher.price,
          methodDisplayName: formatPaymentType(method),
        });
      }

      return acc;
    },
    [],
  );

  // Sort payment methods by count
  const sortedPaymentMethods = [...paymentMethods].sort(
    (a, b) => b.count - a.count,
  );

  // Calculate totals
  const totalRevenue = filteredVouchers.reduce(
    (total, v) => total + v.price,
    0,
  );
  const totalVouchers = filteredVouchers.length;

  // Set date preset
  const setDatePreset = (preset: string) => {
    const today = startOfToday();

    switch (preset) {
      case "today":
        setDateRange({ from: today, to: today });
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        setDateRange({ from: yesterday, to: yesterday });
        break;
      case "7days":
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case "30days":
        setDateRange({ from: subDays(today, 29), to: today });
        break;
      case "thisMonth":
        const firstDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        );
        setDateRange({ from: firstDayOfMonth, to: today });
        break;
      case "lastMonth":
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
        setDateRange({ from: firstDayLastMonth, to: lastDayLastMonth });
        break;
      case "all":
        setDateRange({ from: undefined, to: undefined });
        break;
    }
  };

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Métodos de Pagamento</h1>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Date range tabs */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="today" onClick={() => setDatePreset("today")}>
            Hoje
          </TabsTrigger>
          <TabsTrigger
            value="yesterday"
            onClick={() => setDatePreset("yesterday")}
          >
            Ontem
          </TabsTrigger>
          <TabsTrigger value="7days" onClick={() => setDatePreset("7days")}>
            7 dias
          </TabsTrigger>
          <TabsTrigger value="30days" onClick={() => setDatePreset("30days")}>
            30 dias
          </TabsTrigger>
          <TabsTrigger
            value="thisMonth"
            onClick={() => setDatePreset("thisMonth")}
          >
            Este mês
          </TabsTrigger>
          <TabsTrigger
            value="lastMonth"
            onClick={() => setDatePreset("lastMonth")}
          >
            Mês passado
          </TabsTrigger>
          <TabsTrigger value="all" onClick={() => setDatePreset("all")}>
            Todos
          </TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>
        <TabsContent value="custom" className="mt-4">
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-between"
                >
                  <span>
                    {dateRange.from
                      ? formatDate(dateRange.from)
                      : "Data inicial"}
                  </span>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) =>
                    setDateRange({ ...dateRange, from: date })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span>até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-between"
                >
                  <span>
                    {dateRange.to ? formatDate(dateRange.to) : "Data final"}
                  </span>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </TabsContent>
      </Tabs>

      {/* Search */}
      <div className="mb-6 w-full max-w-sm">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
          <Input
            placeholder="Buscar por método de pagamento"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalRevenue)}
                </div>
                <p className="text-muted-foreground text-xs">
                  {totalVouchers} vouchers
                </p>
              </div>
              <DollarSign className="text-primary/20 h-10 w-10" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Métodos de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {paymentMethods.length}
                </div>
                <p className="text-muted-foreground text-xs">
                  Métodos distintos utilizados
                </p>
              </div>
              <CreditCard className="text-primary/20 h-10 w-10" />
            </div>
          </CardContent>
        </Card>

        {sortedPaymentMethods.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Método Mais Popular
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {sortedPaymentMethods[0]?.methodDisplayName ?? ""}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {sortedPaymentMethods[0]?.count ?? 0} vouchers (
                    {sortedPaymentMethods[0]
                      ? Math.round(
                          (sortedPaymentMethods[0].count / totalVouchers) * 100,
                        )
                      : 0}
                    %)
                  </p>
                </div>
                <CreditCard className="text-primary/20 h-10 w-10" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Methods Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Métodos de Pagamento</CardTitle>
          <CardDescription>
            Detalhes de todos os métodos de pagamento utilizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          ) : sortedPaymentMethods.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método de Pagamento</TableHead>
                  <TableHead>Vouchers</TableHead>
                  <TableHead>% do Total</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPaymentMethods.map((method) => (
                  <TableRow key={method.method}>
                    <TableCell className="font-medium">
                      {method.methodDisplayName}
                    </TableCell>
                    <TableCell>{method.count}</TableCell>
                    <TableCell>
                      {Math.round((method.count / totalVouchers) * 100)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(method.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(method.revenue / method.count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">
                Nenhum método de pagamento encontrado para os filtros
                selecionados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
