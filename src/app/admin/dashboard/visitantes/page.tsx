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
import { Calendar } from "@/components/ui/calendar";
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
  addDays,
  isToday,
  startOfDay,
  isSameDay,
  isFuture,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/utils";

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

// Define local type to represent a voucher with payment_id as string | null, and force expires_at and deletedAt to be non-optional (Date | null)
type MyVoucher = Omit<Voucher, "payment_id" | "expires_at" | "deletedAt"> & {
  payment_id: string | null;
  expires_at: Date | null;
  deletedAt: Date | null;
};

export default function VisitorsPage() {
  // Current date state for calendar navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );

  // Get all valid vouchers that haven't been used yet
  const { data: validVouchers, isLoading } =
    api.voucher.findValid.useQuery<MyVoucher[]>();

  // Get today's vouchers
  const { data: todayVouchers } =
    api.voucher.getTodayVouchers.useQuery<MyVoucher[]>();

  // Fetch all vouchers to calculate historical data
  const { data: allVouchers } = api.voucher.findAll.useQuery<MyVoucher[]>();

  // Function to format date for display
  const formatDate = (date: Date) => {
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  // Function to navigate to next month
  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  // Function to navigate to previous month
  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  // Get vouchers expected on the selected date
  const getExpectedVouchersForDate = (date: Date): MyVoucher[] => {
    if (!validVouchers) return [];

    return validVouchers.filter((voucher: MyVoucher) => {
      if (!voucher.expires_at) return false;
      const expiresDate = new Date(voucher.expires_at);
      return isSameDay(expiresDate, date);
    });
  };

  // Get all expected visitors for today
  const todayTotalVisitors =
    todayVouchers?.reduce(
      (total, voucher) => total + voucher.adults + voucher.elderly,
      0,
    ) ?? 0;

  // Get all expected adult visitors for today
  const todayAdultVisitors =
    todayVouchers?.reduce((total, voucher) => total + voucher.adults, 0) ?? 0;

  // Get all expected elderly visitors for today
  const todayElderlyVisitors =
    todayVouchers?.reduce((total, voucher) => total + voucher.elderly, 0) ?? 0;

  const selectedDateVouchers = selectedDate
    ? getExpectedVouchersForDate(selectedDate)
    : [];

  // Calculate visitors for selected date
  const selectedDateVisitors = selectedDateVouchers.reduce(
    (total, voucher) => total + voucher.adults + voucher.elderly,
    0,
  );

  // Calculate adult visitors for selected date
  const selectedDateAdults = selectedDateVouchers.reduce(
    (total, voucher) => total + voucher.adults,
    0,
  );

  // Calculate elderly visitors for selected date
  const selectedDateElderly = selectedDateVouchers.reduce(
    (total, voucher) => total + voucher.elderly,
    0,
  );

  // Generate daily visitor data for the next 7 days
  const nextSevenDaysData = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(startOfDay(new Date()), i);
    const dateVouchers = getExpectedVouchersForDate(date);

    return {
      date,
      visitors: dateVouchers.reduce(
        (total, v) => total + v.adults + v.elderly,
        0,
      ),
      adults: dateVouchers.reduce((total, v) => total + v.adults, 0),
      elderly: dateVouchers.reduce((total, v) => total + v.elderly, 0),
      vouchers: dateVouchers.length,
    };
  });

  return (
    <div className="px-8 py-6">
      <h1 className="mb-6 text-2xl font-bold">Visitantes</h1>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Today's info */}
        <Card>
          <CardHeader>
            <CardTitle>Visitantes de Hoje</CardTitle>
            <CardDescription>
              {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  Total de Visitantes
                </p>
                <p className="text-3xl font-bold">{todayTotalVisitors}</p>
              </div>
              <Users className="text-primary/20 h-10 w-10" />
            </div>
            <div className="flex w-full justify-between gap-4">
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-primary text-sm font-medium">Inteiras</p>
                <p className="text-xl font-bold">{todayAdultVisitors}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-primary text-sm font-medium">Meias</p>
                <p className="text-xl font-bold">{todayElderlyVisitors}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-primary text-sm font-medium">Vouchers</p>
                <p className="text-xl font-bold">
                  {todayVouchers?.length ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected day info */}
        <Card>
          <CardHeader>
            <CardTitle>Data Selecionada</CardTitle>
            <CardDescription>
              {selectedDate
                ? formatDate(selectedDate)
                : "Nenhuma data selecionada"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Total de Visitantes
                    </p>
                    <p className="text-3xl font-bold">{selectedDateVisitors}</p>
                  </div>
                  <CalendarIcon className="text-primary/20 h-10 w-10" />
                </div>
                <div className="flex w-full justify-between gap-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-primary text-sm font-medium">Inteiras</p>
                    <p className="text-xl font-bold">{selectedDateAdults}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-primary text-sm font-medium">Meias</p>
                    <p className="text-xl font-bold">{selectedDateElderly}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-primary text-sm font-medium">Vouchers</p>
                    <p className="text-xl font-bold">
                      {selectedDateVouchers.length}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex h-32 items-center justify-center">
                Selecione uma data no calendário para ver os detalhes.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        {/* Calendar for date selection */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Calendário</CardTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="hover:bg-muted rounded-full p-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="hover:bg-muted rounded-full p-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Upcoming visitors */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Próximos 7 Dias</CardTitle>
            <CardDescription>
              Previsão de visitantes para os próximos dias
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
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : nextSevenDaysData.every((day) => day.visitors === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Nenhum visitante previsto para os próximos 7 dias.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nextSevenDaysData.map((day, index) => (
                      <TableRow
                        key={index}
                        className={isToday(day.date) ? "bg-primary/5" : ""}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {isToday(day.date) && (
                              <Clock className="text-primary mr-2 h-4 w-4" />
                            )}
                            {format(day.date, "EEE, dd/MM", { locale: ptBR })}
                            {isToday(day.date) && (
                              <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-bold">
                                Hoje
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{day.vouchers}</TableCell>
                        <TableCell>{day.adults}</TableCell>
                        <TableCell>{day.elderly}</TableCell>
                        <TableCell className="text-right font-bold">
                          {day.visitors}
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

      {/* Selected date vouchers details */}
      {selectedDate && selectedDateVouchers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Detalhes dos Vouchers para{" "}
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              Lista de todos os vouchers válidos para a data selecionada
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
                    <TableHead>Inteiras</TableHead>
                    <TableHead>Meias</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDateVouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-medium">
                        {voucher.code}
                      </TableCell>
                      <TableCell>{voucher.name}</TableCell>
                      <TableCell>{formatPhone(voucher.phone)}</TableCell>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
