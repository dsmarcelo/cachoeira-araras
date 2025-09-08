"use client";

import { useState } from "react";
import { addDays, subDays } from "date-fns";

import { Calendar } from "@/components/ui/calendar";

export default function Component() {
  const today = new Date();
  const [date, setDate] = useState<Date[] | undefined>([
    subDays(today, 17),
    addDays(today, 2),
    addDays(today, 6),
    addDays(today, 8),
  ]);

  return (
    <div>
      <Calendar
        mode="multiple"
        selected={date}
        onSelect={setDate}
        className="rounded-md border p-2"
      />
    </div>
  );
}
