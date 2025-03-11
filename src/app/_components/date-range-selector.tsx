/*
  TimeRangeSelector Component
  This component allows a user to select time ranges using preset options or by choosing a specific month and year.
  It uses ShadcnUI components and updates the browser URL with selected time range details.
  Comments are added for clarity.
*/

/* eslint-disable react-hooks/rules-of-hooks */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startOfDay, subDays, startOfMonth, subMonths } from "date-fns";

function DateRangeSelector() {
  const router = useRouter();

  // State for selected month and year in the dropdowns
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>("1");
  const [selectedYear, setSelectedYear] = useState<string>(
    currentYear.toString(),
  );

  // Add a state for the selected preset
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  // Initialize from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("from");
    const presetParam = params.get("preset");

    if (fromParam) {
      try {
        const fromDate = new Date(fromParam);
        if (!isNaN(fromDate.getTime())) {
          // Set month and year based on from date
          setSelectedMonth((fromDate.getMonth() + 1).toString());
          setSelectedYear(fromDate.getFullYear().toString());

          // If preset is also provided, set it
          if (presetParam) {
            setSelectedPreset(presetParam);
          }
        }
      } catch (error) {
        console.error("Error parsing date from URL:", error);
      }
    }
  }, []);

  // Create a presets array for the dropdown options
  const presets = [
    { value: "today", label: "Hoje" },
    { value: "yesterday", label: "Ontem" },
    { value: "last7days", label: "Últimos 7 Dias" },
    { value: "currentWeek", label: "Semana Atual" },
    { value: "lastWeek", label: "Semana Passada" },
    { value: "last30Days", label: "Últimos 30 Dias" },
    { value: "thisMonth", label: "Este Mês" },
    { value: "lastMonth", label: "Mês Passado" },
  ];

  // This function updates the URL with preset type, start and end dates
  const updateUrl = (preset: string, start: string, end: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("preset", preset);
    params.set("from", start);
    params.set("to", end);

    // Update the browser URL without adding a new history entry
    window.history.replaceState({}, "", `?${params.toString()}`);

    // Optionally, refresh the page data if necessary
    router.refresh();
  };

  // Handler for preset buttons with extended options
  const handlePreset = (preset: string) => {
    let start: string, end: string;
    const today = new Date();
    let startDate: Date; // Add this variable to track the start date

    switch (preset) {
      case "today": {
        startDate = startOfDay(today);
        start = startDate.toISOString();
        end = today.toISOString();
        break;
      }
      case "yesterday": {
        startDate = startOfDay(subDays(today, 1));
        start = startDate.toISOString();
        end = startDate.toISOString();
        break;
      }
      case "last7days": {
        startDate = startOfDay(subDays(today, 6));
        start = startDate.toISOString();
        end = today.toISOString();
        break;
      }
      case "currentWeek": {
        // Calculate current week's Monday and Sunday
        const currentDay = today.getDay();
        const dayNumber = currentDay === 0 ? 7 : currentDay;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayNumber + 1);
        const sunday = new Date(startDate);
        sunday.setDate(startDate.getDate() + 6);
        start = startDate.toISOString();
        end = sunday.toISOString();
        break;
      }
      case "lastWeek": {
        // Calculate last week's Monday and Sunday
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        const lastDay = lastWeek.getDay();
        const dayNumber = lastDay === 0 ? 7 : lastDay;
        startDate = new Date(lastWeek);
        startDate.setDate(lastWeek.getDate() - dayNumber + 1);
        const sunday = new Date(startDate);
        sunday.setDate(startDate.getDate() + 6);
        start = startDate.toISOString();
        end = sunday.toISOString();
        break;
      }
      case "last30Days": {
        startDate = subDays(today, 29);
        start = startDate.toISOString();
        end = today.toISOString();
        break;
      }
      case "thisMonth": {
        startDate = startOfMonth(today);
        start = startDate.toISOString();
        end = today.toISOString();
        break;
      }
      case "lastMonth": {
        const lastMonthDate = subMonths(today, 1);
        startDate = startOfMonth(lastMonthDate);
        start = startDate.toISOString();
        const endDate = subDays(startOfMonth(today), 1);
        end = endDate.toISOString();
        break;
      }
      default:
        return;
    }

    // Update the URL
    updateUrl(preset, start, end);

    // Update the month and year dropdowns to match the start date
    const startMonth = (startDate.getMonth() + 1).toString(); // +1 because getMonth() is 0-indexed
    const startYear = startDate.getFullYear().toString();

    // Update the state variables for month and year
    setSelectedMonth(startMonth);
    setSelectedYear(startYear);
  };

  // Handler when month or year selection changes
  const handleMonthYear = (month: string, year: string) => {
    // Calculate first day of the month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    // Calculate last day of month by setting date to 0 of next month
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    updateUrl("month", startDate.toISOString(), endDate.toISOString());
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

  // Add a handler for preset selection
  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    handlePreset(value);
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
      {/* Preset dropdown for quick selection */}
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione Período" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        <SelectTrigger className="w-full">
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
  );
}

export default DateRangeSelector;
