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
import { type Voucher as PrismaVoucher } from "@prisma/client";

// Extended voucher type that includes pool fields
type VoucherWithType = PrismaVoucher & {
  adults_pool: number;
  elderly_pool: number;
};
import { useSearchParams } from "next/navigation";
import { startOfMonth } from "date-fns";
import DateRangeSelector from "@/app/_components/date-range-selector";

// Status filter options with colors
const statusOptions = [
  { value: "all", label: "Todos os Status", color: "gray" },
  { value: "valid", label: "Válidos", color: "green" },
  { value: "pending", label: "Pendentes", color: "yellow" },
  { value: "used", label: "Utilizados", color: "blue" },
  { value: "expired", label: "Expirados", color: "red" },
];

export default function VouchersPage() {
  // State for search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get URL params for date range
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRange =
    fromParam && toParam
      ? { from: new Date(fromParam), to: new Date(toParam) }
      : { from: startOfMonth(new Date()), to: new Date() };

  // Get all vouchers
  const { data: allVouchers, isLoading } = api.voucher.findAll.useQuery();

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

  // Filter vouchers
  const filteredVouchers: VoucherWithType[] = !allVouchers
    ? []
    : (allVouchers as VoucherWithType[]).filter((voucher) => {
      // Status filter
      const matchesStatus =
        statusFilter === "all" ? true : voucher.status === statusFilter;

      // Date range filter
      const voucherDate = new Date(voucher.createdAt);
      const matchesDateRange =
        voucherDate >= dateRange.from && voucherDate <= dateRange.to;

      // Search filter
      const matchesSearch = !searchQuery
        ? true
        : voucher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        voucher.phone.includes(searchQuery) ||
        voucher.code.includes(searchQuery);

      return matchesStatus && matchesDateRange && matchesSearch;
    });

  // Calculate statistics
  const totalSales = filteredVouchers.reduce((total, v) => total + v.price, 0);
  const totalAdults = filteredVouchers.reduce(
    (total, v) => total + v.adults,
    0,
  );
  const totalElderly = filteredVouchers.reduce(
    (total, v) => total + v.elderly,
    0,
  );
  const validCount = filteredVouchers.filter(
    (v) => v.status === "valid",
  ).length;
  const pendingCount = filteredVouchers.filter(
    (v) => v.status === "pending",
  ).length;
  const usedCount = filteredVouchers.filter((v) => v.status === "used").length;
  const expiredCount = filteredVouchers.filter(
    (v) => v.status === "expired",
  ).length;

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciamento de Vouchers</h1>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Replace the old Popover date range selector with the DateRangeSelector component */}
      <div className="mb-6">
        <DateRangeSelector />
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou código"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center">
                    <span
                      className={`mr-2 h-2 w-2 rounded-full bg-${option.color}-500`}
                    ></span>
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Statistics Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Receita
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalSales)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredVouchers.length} vouchers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status dos Vouchers
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-xs">Válidos: {validCount}</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-yellow-500"></span>
                  <span className="text-xs">Pendentes: {pendingCount}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-blue-500"></span>
                  <span className="text-xs">Utilizados: {usedCount}</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
                  <span className="text-xs">Expirados: {expiredCount}</span>
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
            <div className="text-2xl font-bold">
              {totalAdults + totalElderly}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalAdults} inteiras, {totalElderly} meias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Média por Voucher
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredVouchers.length > 0
                ? formatCurrency(totalSales / filteredVouchers.length)
                : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(filteredVouchers.length > 0
                ? (totalAdults + totalElderly) / filteredVouchers.length
                : 0
              ).toFixed(1)}{" "}
              pessoas/voucher
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vouchers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vouchers ({filteredVouchers.length})</CardTitle>
          <CardDescription>
            Gerencie todos os vouchers do sistema.
          </CardDescription>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center">
                      Nenhum voucher encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-medium">
                        {voucher.code}
                      </TableCell>
                      <TableCell>{voucher.name}</TableCell>
                      <TableCell>{formatPhone(voucher.phone)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${voucher.status === "valid"
                            ? "bg-green-100 text-green-800"
                            : voucher.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : voucher.status === "used"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            }`}
                        >
                          {voucher.status === "valid" && (
                            <Check className="mr-1 h-3 w-3" />
                          )}
                          {voucher.status === "pending" && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {voucher.status === "used" && (
                            <Check className="mr-1 h-3 w-3" />
                          )}
                          {voucher.status === "expired" && (
                            <X className="mr-1 h-3 w-3" />
                          )}
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
                      <TableCell>{voucher.adults_pool || 0}</TableCell>
                      <TableCell>{voucher.elderly_pool || 0}</TableCell>
                      <TableCell>{formatCurrency(voucher.price)}</TableCell>
                      <TableCell>{formatDate(voucher.createdAt)}</TableCell>
                      <TableCell>
                        {voucher.expires_at
                          ? formatDate(voucher.expires_at)
                          : "N/A"}
                      </TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
