"use client";

import { DayPicker } from "@daypicker/react";
import { ptBR } from "@daypicker/react/locale";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * coss/ui Calendar (https://coss.com/ui/docs/components/calendar) ported to
 * Tailwind v3 and pt-BR. Built on react-day-picker v10 (`@daypicker/react`),
 * unlike `./calendar.tsx`, which wraps v8 and is still used elsewhere.
 *
 * The coss source relies on Tailwind v4 variants (`in-data-*`), so state
 * styles hang off a `group` on the day cell (`data-selected`, `range-middle`...)
 * and are read by the day button through `group-*` variants.
 */
const buttonClassNames =
  "relative flex size-[var(--cell-size)] items-center justify-center rounded-lg text-base text-foreground outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-60 sm:text-sm [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:opacity-80 sm:[&_svg]:size-4";

const defaultClassNames = {
  button_next: buttonClassNames,
  button_previous: buttonClassNames,
  caption_label:
    "flex h-full items-center gap-2 text-base font-medium sm:text-sm",
  day: "group size-[var(--cell-size)] py-px text-sm",
  day_button: cn(
    buttonClassNames,
    "focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-ring",
    "group-data-[selected]:bg-primary group-data-[selected]:text-primary-foreground group-data-[selected]:hover:bg-primary",
    "group-data-[outside]:text-muted-foreground group-data-[selected]:group-data-[outside]:text-primary-foreground",
    "group-data-[disabled]:pointer-events-none group-data-[disabled]:text-muted-foreground group-data-[disabled]:line-through",
    "group-[.range-middle]:rounded-none group-[.range-middle]:group-data-[selected]:bg-accent group-[.range-middle]:group-data-[selected]:text-foreground",
    "group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none",
  ),
  dropdown: "absolute inset-0 bg-popover opacity-0",
  dropdown_root:
    "relative h-9 rounded-lg border border-input px-[11px] shadow-sm has-[:focus]:border-ring has-[:focus]:ring-2 has-[:focus]:ring-ring sm:h-8 [&_svg]:pointer-events-none [&_svg]:-me-1 [&_svg]:size-[18px] [&_svg]:opacity-80 sm:[&_svg]:size-4",
  dropdowns:
    "flex h-[var(--cell-size)] w-full items-center justify-center gap-1.5 text-base sm:text-sm [&>span]:font-medium",
  hidden: "invisible",
  month: "w-full",
  month_caption:
    "relative z-[2] mx-[var(--cell-size)] mb-1 flex h-[var(--cell-size)] items-center justify-center px-1",
  months: "relative flex flex-col gap-2 sm:flex-row",
  nav: "absolute top-0 z-[1] flex w-full justify-between",
  outside: "text-muted-foreground data-[selected]:bg-accent data-[selected]:text-muted-foreground",
  range_end: "range-end",
  range_middle: "range-middle",
  range_start: "range-start",
  today:
    "*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-[1] *:after:size-[3px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-primary [&[data-selected]:not(.range-middle)>*]:after:bg-background [&[data-disabled]>*]:after:bg-muted-foreground",
  week_number:
    "size-[var(--cell-size)] p-0 text-xs font-medium text-muted-foreground",
  weekday:
    "size-[var(--cell-size)] p-0 text-xs font-medium text-muted-foreground",
};

function CossCalendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: React.ComponentProps<typeof DayPicker>): React.ReactElement {
  const mergedClassNames = Object.fromEntries(
    Object.entries(defaultClassNames).map(([key, base]) => {
      const extra = classNames?.[key as keyof typeof classNames];
      return [key, extra ? cn(base, extra) : base];
    }),
  ) as typeof defaultClassNames;

  const components: React.ComponentProps<typeof DayPicker>["components"] = {
    Chevron: ({ className, orientation, ...chevronProps }) => {
      if (orientation === "left") {
        return (
          <ChevronLeftIcon
            className={className}
            {...chevronProps}
            aria-hidden="true"
          />
        );
      }
      if (orientation === "right") {
        return (
          <ChevronRightIcon
            className={className}
            {...chevronProps}
            aria-hidden="true"
          />
        );
      }
      return (
        <ChevronsUpDownIcon
          className={className}
          {...chevronProps}
          aria-hidden="true"
        />
      );
    },
    ...userComponents,
  };

  return (
    <DayPicker
      className={cn(
        "w-fit [--cell-size:2.5rem] sm:[--cell-size:2.25rem]",
        className,
      )}
      classNames={mergedClassNames}
      components={components}
      data-slot="calendar"
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("pt-BR", { month: "short" }),
      }}
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { CossCalendar };
