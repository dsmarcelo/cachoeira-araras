/*
  TimeRangeSelector Component
  This component allows a user to select time ranges using specific month/year selectors or a date range picker.
  It uses ShadcnUI components and updates the browser URL with selected time range details.
*/

/* eslint-disable react-hooks/rules-of-hooks */

"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DateRangePicker from "../date-range-picker";

function DateRangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State for selected month and year in the dropdowns
  const today = React.useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    (today.getMonth() + 1).toString(),
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    currentYear.toString(),
  );

  // Initialize from URL parameters; when missing, default to the current month.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const fromParam = params.get("from");
    const toParam = params.get("to");

    if (!fromParam || !toParam) {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      params.set("preset", "mesAtual");
      params.set("from", startDate.toISOString());
      params.set("to", today.toISOString());
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    try {
      const fromDate = new Date(fromParam);
      if (!isNaN(fromDate.getTime())) {
        // Set month and year based on from date
        setSelectedMonth((fromDate.getMonth() + 1).toString());
        setSelectedYear(fromDate.getFullYear().toString());
      }
    } catch (error) {
      console.error("Error parsing date from URL:", error);
    }
  }, [pathname, router, searchParams, today]);

  // This function updates the URL with start and end dates for month/year selection
  const updateUrl = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", "month"); // Set preset to "month" to indicate a month selection
    params.set("from", start);
    params.set("to", end);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handler when month or year selection changes
  const handleMonthYear = (month: string, year: string) => {
    // Calculate first day of the month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    // Calculate last day of month by setting date to 0 of next month
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    updateUrl(startDate.toISOString(), endDate.toISOString());
  };

  // Options for months
  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  // Options for years (last 20 years including current year)
  const years = [];
  for (let y = currentYear; y >= currentYear - 20; y--) {
    years.push({ value: y.toString(), label: y.toString() });
  }

  // Handle changes to month dropdown
  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    handleMonthYear(newMonth, selectedYear);
  };

  // Handle changes to year dropdown
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    handleMonthYear(selectedMonth, newYear);
  };

  // Listen for URL changes from the calendar component
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get("from");

      if (fromParam) {
        try {
          const fromDate = new Date(fromParam);
          if (!isNaN(fromDate.getTime())) {
            setSelectedMonth((fromDate.getMonth() + 1).toString());
            setSelectedYear(fromDate.getFullYear().toString());
          }
        } catch (error) {
          console.error("Error parsing date from URL:", error);
        }
      }
    };

    // Add an event listener for popstate events
    window.addEventListener("popstate", handleUrlChange);

    return () => {
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Date range picker component */}
        <div>
          <DateRangePicker />
        </div>

        {/* Month/Year selector section */}
        <div>
          <div className="flex gap-4">
            {/* Dropdowns for selecting a specific month and year */}
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Selecione o Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DateRangeSelector;
