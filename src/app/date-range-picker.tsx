"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  format,
  parseISO,
  startOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useId, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";

export default function DateRangePicker() {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useState(() => new Date())[0];
  const currentMonthRange = { from: startOfMonth(today), to: today };
  const [date, setDate] = useState<DateRange | undefined>(currentMonthRange);
  const [month, setMonth] = useState(today);

  // Define preset date ranges
  const presets = {
    hoje: {
      from: startOfDay(today),
      to: today,
      label: "Hoje"
    },
    ontem: {
      from: startOfDay(subDays(today, 1)),
      to: subDays(today, 1),
      label: "Ontem"
    },
    ultimos7Dias: {
      from: subDays(today, 6),
      to: today,
      label: "Últimos 7 Dias"
    },
    ultimos30Dias: {
      from: subDays(today, 29),
      to: today,
      label: "Últimos 30 Dias"
    },
    mesAtual: {
      from: startOfMonth(today),
      to: today,
      label: "Este Mês"
    },
    mesAnterior: {
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1)),
      label: "Mês Passado"
    },
    anoAtual: {
      from: startOfYear(today),
      to: today,
      label: "Este Ano"
    },
    anoAnterior: {
      from: startOfYear(subYears(today, 1)),
      to: endOfYear(subYears(today, 1)),
      label: "Ano Anterior"
    }
  };

  // Initialize from URL parameters
  useEffect(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (fromParam) {
      try {
        const fromDate = parseISO(fromParam);

        if (!isNaN(fromDate.getTime())) {
          const newRange: DateRange = { from: fromDate };

          if (toParam) {
            const toDate = parseISO(toParam);
            if (!isNaN(toDate.getTime())) {
              newRange.to = toDate;
            }
          }

          setDate(newRange);
          // Update the displayed month to match the selected date
          setMonth(fromDate);
        }
      } catch (error) {
        console.error("Error parsing dates from URL:", error);
      }
    }
  }, [searchParams]);

  // Update URL when date range changes
  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);

    if (newDate?.from) {
      const params = new URLSearchParams(window.location.search);
      params.set("from", newDate.from.toISOString());

      if (newDate.to) {
        params.set("to", newDate.to.toISOString());
      } else {
        params.delete("to");
      }

      // Reset preset param as this is a custom selection
      params.delete("preset");

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  // Handle preset button clicks
  const handlePresetClick = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    const newRange = { from: preset.from, to: preset.to };

    setDate(newRange);
    setMonth(preset.to);

    // Update URL with preset info and date range
    const params = new URLSearchParams(window.location.search);
    params.set("preset", presetKey);
    params.set("from", preset.from.toISOString());
    params.set("to", preset.to.toISOString());

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      <div className="*:not-first:mt-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant={"outline"}
              className={cn(
                "group w-full justify-between border-input bg-background px-3 font-normal outline-none outline-offset-0 hover:bg-background focus-visible:outline-[3px]",
                !date && "text-muted-foreground",
              )}
            >
              <span
                className={cn("truncate", !date && "text-muted-foreground")}
              >
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd 'de' MMMM, yyyy", {
                        locale: ptBR,
                      })}{" "}
                      -{" "}
                      {format(date.to, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </>
                  ) : (
                    format(date.from, "dd 'de' MMMM, yyyy", { locale: ptBR })
                  )
                ) : (
                  "Selecione um intervalo"
                )}
              </span>
              <CalendarIcon
                size={16}
                className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="rounded-md border">
              <div className="flex max-sm:flex-col">
                <div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-40">
                  <div className="h-full sm:border-e">
                    <div className="flex flex-col px-2">
                      {Object.entries(presets).map(([key, preset]) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handlePresetClick(key as keyof typeof presets)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <Calendar
                  mode="range"
                  selected={date}
                  onSelect={handleDateSelect}
                  month={month}
                  onMonthChange={setMonth}
                  className="p-2"
                  locale={ptBR}
                  disabled={[{ after: new Date() }]} // Disable future dates
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
