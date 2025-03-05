import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";

// Define the type for the custom date range
export type CustomDateRange = { from?: Date; to?: Date };

// Define props for the TimeRangeSelector component
interface TimeRangeSelectorProps {
  // Callback to pass the selected time range back to parent
  onChange: (timeRange: {
    dateFilter: string;
    customDateRange: CustomDateRange;
  }) => void;
}

// Predefined time range options
const timeRangeOptions = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7days", label: "Últimos 7 dias" },
  { value: "last30days", label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

// TimeRangeSelector component implementation
const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ onChange }) => {
  // Local state for selected filter option
  const [selectedOption, setSelectedOption] = useState<string>("today");

  // Local state for custom date range if 'custom' is selected
  const [customRange, setCustomRange] = useState<CustomDateRange>({});

  // Local state to control the calendar popover
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  // Handles changes in the select dropdown
  const handleSelectChange = (value: string) => {
    setSelectedOption(value);
    // If not custom, update parent immediately
    if (value !== "custom") {
      onChange({ dateFilter: value, customDateRange: {} });
    }
  };

  // Handles changes when a custom date range is selected via the calendar
  const handleCustomRangeSelect = (range: CustomDateRange | undefined) => {
    // Close the popover
    setIsPopoverOpen(false);
    // Update the custom range state
    const newRange = range ?? {};
    setCustomRange(newRange);
    // Pass the updated custom range upwards
    onChange({ dateFilter: "custom", customDateRange: newRange });
  };

  // Render the custom range button, showing selected dates if available
  const renderCustomRangeButton = () => {
    let buttonLabel = "Selecione as datas";
    if (customRange.from) {
      // Format dates to dd/MM/yyyy
      const fromDate = customRange.from.toLocaleDateString("pt-BR");
      if (customRange.to) {
        const toDate = customRange.to.toLocaleDateString("pt-BR");
        buttonLabel = `${fromDate} - ${toDate}`;
      } else {
        buttonLabel = fromDate;
      }
    }
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" /> {buttonLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {/* Calendar in range mode to select custom dates. The Calendar component should support range selection. */}
          <Calendar
            mode="range"
            selected={
              customRange.from
                ? {
                    from: customRange.from,
                    to: customRange.to ?? customRange.from,
                  }
                : undefined
            }
            onSelect={handleCustomRangeSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Select dropdown for time range options */}
      <Select value={selectedOption} onValueChange={handleSelectChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {timeRangeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* If custom option is selected, show the custom calendar picker */}
      {selectedOption === "custom" && renderCustomRangeButton()}
    </div>
  );
};

export default TimeRangeSelector;
