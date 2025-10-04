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
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Ticket, Users } from "lucide-react";
import type { Voucher } from "@/types/voucher";

// Date filter options

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

  // Get today's vouchers (visitors expected today)
  const { data: todayVouchers, isLoading } =
    api.voucher.getTodayVouchers.useQuery<Voucher[]>() as {
      data: Voucher[] | undefined;
      isLoading: boolean;
    };

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

  // Calculate metrics - only count paid vouchers (payment_id !== null)
  const calculateTotalRevenue = (vouchers: Voucher[]): number => {
    if (!vouchers || vouchers.length === 0) return 0;
    // Only count vouchers with confirmed payment
    const paidVouchers = vouchers.filter((voucher) => voucher.payment_id !== null);
    return paidVouchers.reduce((total, voucher) => total + voucher.price, 0);
  };

  const calculateTotalVisitors = (vouchers: Voucher[]): number => {
    if (!vouchers || vouchers.length === 0) return 0;
    // Filter vouchers that are confirmed (valid) and paid (payment_id exists)
    const confirmedPaid = vouchers.filter(
      (voucher) => voucher.valid && voucher.payment_id !== null,
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
      <h1 className="mb-6 text-2xl font-bold">Visão Geral de Hoje</h1>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  {filteredTodayVouchers.filter((v: Voucher) => v.payment_id !== null).length} vouchers pagos
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
                  {filteredTodayVouchers
                    .filter((v: Voucher) => v.payment_id !== null)
                    .reduce((total, v: Voucher) => total + v.adults, 0)}{" "}
                  inteiras,{" "}
                  {filteredTodayVouchers
                    .filter((v: Voucher) => v.payment_id !== null)
                    .reduce((total, v: Voucher) => total + v.elderly, 0)}{" "}
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
                  {filteredTodayVouchers.filter((v: Voucher) => v.payment_id !== null).length} vouchers pagos para hoje
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
                  {filteredTodayVouchers.length}
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
                Lista de todos os vouchers de hoje.
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
                    ) : filteredTodayVouchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          Nenhum voucher encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTodayVouchers.map((voucher) => (
                        <TableRow key={voucher.id}>
                          <TableCell>{voucher.code}</TableCell>
                          <TableCell>{voucher.name}</TableCell>
                          <TableCell>{voucher.phone}</TableCell>
                          <TableCell>
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${voucher.status === "valid"
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
      </Tabs>

      {/* Voucher details for today */}
      <Card>
        <CardHeader>
          {filteredTodayVouchers.length > 0 ? (
            <>
              <CardTitle>Detalhes dos Vouchers</CardTitle>
              <CardDescription>
                Data: {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
              </CardDescription>
            </>
          ) : (
            <CardTitle>Detalhes dos Vouchers</CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {filteredTodayVouchers.length > 0 ? (
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
                  {filteredTodayVouchers.map((voucher) => (
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
              Nenhum voucher encontrado para hoje.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
