"use client";

import { Calendar } from "@/components/ui/calendar";

interface MultipleDaysCalendarProps {
  /** Controlled value with the selected dates */
  value?: Date[] | undefined;
  /** Change handler fired when selection changes */
  onChange?: (dates: Date[] | undefined) => void;
  /** Disable interactions (visually and functionally) */
  disabled?: boolean;
  /** Extra class names for container */
  className?: string;
}

export default function MultipleDaysCalendar({
  value,
  onChange,
  disabled = false,
  className,
}: MultipleDaysCalendarProps) {
  return (
    <div className={className} aria-disabled={disabled}>
      <Calendar
        mode="multiple"
        selected={value}
        onSelect={onChange}
        className="rounded-md border p-2"
        // Prevent focusing/interaction if disabled
        modifiersClassNames={
          disabled ? { selected: "pointer-events-none opacity-50" } : undefined
        }
      />
    </div>
  );
}
