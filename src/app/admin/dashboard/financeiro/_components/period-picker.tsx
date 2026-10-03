"use client";

import { useState } from "react";
import { subMonths } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PERIOD_PRESETS,
  periodError,
  presetPeriod,
  type Period,
  type PeriodPreset,
} from "@/lib/finance-period";
import { getSaoPauloDateKey } from "@/lib/utils/date";
import { dateToKey, formatPeriod, keyToDate } from "../format";

type PeriodPickerProps = {
  period: Period;
  preset: PeriodPreset | null;
  onApply: (next: { preset: PeriodPreset } | { period: Period }) => void;
};

/**
 * The "Personalizar" control: a trigger showing the current range that opens
 * quick presets plus a range calendar — a bottom drawer on phones, a popover
 * with two months on larger screens. Nothing changes until "Aplicar".
 */
export function PeriodPicker({ period, preset, onApply }: PeriodPickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button
      variant="outline"
      className="h-11 w-full justify-start gap-2 px-3 font-medium md:w-auto"
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-grow text-left">{formatPeriod(period)}</span>
      <span className="font-normal text-muted-foreground">Personalizar</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Button>
  );

  const body = open ? (
    <PeriodForm
      period={period}
      preset={preset}
      inDrawer={isMobile}
      onCancel={() => setOpen(false)}
      onApply={(next) => {
        onApply(next);
        setOpen(false);
      }}
    />
  ) : null;

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[92dvh] overflow-y-auto">{body}</DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        {body}
      </PopoverContent>
    </Popover>
  );
}

function PeriodForm({
  period,
  preset,
  inDrawer,
  onCancel,
  onApply,
}: {
  period: Period;
  preset: PeriodPreset | null;
  inDrawer: boolean;
  onCancel: () => void;
  onApply: PeriodPickerProps["onApply"];
}) {
  const today = getSaoPauloDateKey();
  const [draft, setDraft] = useState<{ preset: PeriodPreset | null; range: DateRange | undefined }>({
    preset,
    range: { from: keyToDate(period.from), to: keyToDate(period.to) },
  });

  const draftPeriod =
    draft.range?.from !== undefined
      ? { from: dateToKey(draft.range.from), to: dateToKey(draft.range.to ?? draft.range.from) }
      : null;
  const error = draftPeriod ? periodError(draftPeriod) : "Escolha a data inicial no calendário.";
  const status = error ?? (draftPeriod ? `${formatPeriod(draftPeriod)} selecionado` : "");
  const lastMonth = keyToDate(draftPeriod?.to ?? today);

  function pickPreset(next: PeriodPreset) {
    const range = presetPeriod(next, today);
    setDraft({ preset: next, range: { from: keyToDate(range.from), to: keyToDate(range.to) } });
  }

  function apply() {
    if (error || !draftPeriod) return;
    onApply(draft.preset ? { preset: draft.preset } : { period: draftPeriod });
  }

  return (
    <div className="flex flex-col">
      <FormHeader inDrawer={inDrawer} />

      <div className="flex flex-wrap gap-2 px-4" role="group" aria-label="Atalhos">
        {(Object.keys(PERIOD_PRESETS) as PeriodPreset[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={draft.preset === key ? "default" : "outline"}
            aria-pressed={draft.preset === key}
            className="h-10 px-3.5"
            onClick={() => pickPreset(key)}
          >
            {PERIOD_PRESETS[key]}
          </Button>
        ))}
      </div>

      <Calendar
        mode="range"
        numberOfMonths={inDrawer ? 1 : 2}
        defaultMonth={inDrawer ? lastMonth : subMonths(lastMonth, 1)}
        selected={draft.range}
        onSelect={(range) => setDraft({ preset: null, range })}
        disabled={{ after: keyToDate(today) }}
        className={inDrawer ? "w-full" : "mx-auto"}
        classNames={inDrawer ? { ...CALENDAR_TODAY, ...CALENDAR_TOUCH } : CALENDAR_TODAY}
      />

      <p
        className="min-h-5 px-4 text-sm text-muted-foreground"
        role={error && draftPeriod ? "alert" : undefined}
      >
        {status}
      </p>

      <DrawerFooter className="flex-row gap-3 md:justify-end">
        <Button variant="outline" className="h-11 flex-1 md:flex-none" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="h-11 flex-1 md:flex-none" disabled={error !== null} onClick={apply}>
          Aplicar período
        </Button>
      </DrawerFooter>
    </div>
  );
}

// Drawer parts need the Drawer's context, so the popover gets a plain header.
function FormHeader({ inDrawer }: { inDrawer: boolean }) {
  if (!inDrawer) {
    return (
      <div className="flex flex-col gap-0.5 p-4">
        <h2 className="text-base font-semibold">Período</h2>
        <p className="text-sm text-muted-foreground">Escolha o intervalo do relatório.</p>
      </div>
    );
  }
  return (
    <DrawerHeader className="text-left">
      <DrawerTitle>Período</DrawerTitle>
      <DrawerDescription>Escolha o intervalo do relatório.</DrawerDescription>
    </DrawerHeader>
  );
}

// The shared Calendar paints "today" dark-on-light, which hides it once it's a selected range end.
const CALENDAR_TODAY = { day_today: "font-semibold" };

// Full-width, 44px-tall day cells for thumbs on the single-month phone calendar.
const CALENDAR_TOUCH = {
  months: "flex w-full",
  caption: "relative flex h-11 items-center justify-center",
  nav_button_previous: "absolute left-0",
  nav_button_next: "absolute right-0",
  month: "w-full space-y-4",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell: "flex-1 text-[0.8rem] font-normal text-slate-500",
  row: "mt-1 flex w-full",
  cell: "relative h-11 flex-1 p-0 text-center text-sm [&:has([aria-selected])]:bg-slate-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected].day-range-end)]:rounded-r-md",
  day: "inline-flex h-11 w-full items-center justify-center rounded-md p-0 font-normal hover:bg-slate-100 aria-selected:opacity-100",
  nav_button:
    "inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-transparent opacity-70 hover:opacity-100",
};
