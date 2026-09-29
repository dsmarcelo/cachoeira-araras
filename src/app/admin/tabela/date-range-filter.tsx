"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "@daypicker/react"

import { Button } from "@/components/ui/button"
import { CossCalendar } from "@/components/ui/calendar-coss"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useWindowWidth } from "@/lib/utils"

/** A date range as calendar-date keys ("YYYY-MM-DD"); "" means the bound is open. */
export type DateRangeValue = { from: string; to: string }

const KEY_FORMAT = "yyyy-MM-dd"
const DISPLAY_FORMAT = "dd/MM/yyyy"

function keyToDate(key: string): Date | undefined {
  return key ? parse(key, KEY_FORMAT, new Date()) : undefined
}

function formatKey(key: string): string {
  const date = keyToDate(key)
  return date ? format(date, DISPLAY_FORMAT) : "…"
}

/**
 * Labeled range picker (popover + calendar) for admin table filters. Reads and
 * writes plain date keys so callers convert to timestamps at the query boundary.
 */
export function DateRangeFilter({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  disabled?: boolean
}) {
  const windowWidth = useWindowWidth()
  const from = keyToDate(value.from)
  const to = keyToDate(value.to)
  const selected: DateRange | undefined = from ? { from, to } : undefined
  const hasValue = value.from !== "" || value.to !== ""

  function handleSelect(range: DateRange | undefined) {
    onChange({
      from: range?.from ? format(range.from, KEY_FORMAT) : "",
      to: range?.to ? format(range.to, KEY_FORMAT) : "",
    })
  }

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-white px-3 text-left shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-45"
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="truncate text-[13px] font-medium">
                {hasValue
                  ? `${formatKey(value.from)} – ${formatKey(value.to)}`
                  : "Qualquer data"}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <CossCalendar
            mode="range"
            numberOfMonths={windowWidth < 640 ? 1 : 2}
            defaultMonth={from}
            selected={selected}
            onSelect={handleSelect}
          />
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasValue}
              onClick={() => onChange({ from: "", to: "" })}
            >
              Limpar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
