"use client";

import * as React from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format, parse } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";
import { formatDateWeekDay } from "@/lib/utils";
import { getBrazilDateKey } from "@/server/voucher-expiry";
import { api } from "@/trpc/react";

const DATE_KEY_FORMAT = "yyyy-MM-dd";

interface props {
  voucherId: number;
  expiresAt: Date;
}

/**
 * Admin-only control that shows the visit date as a button; picking a day in
 * the calendar and confirming saves it and refreshes the voucher lists.
 */
export function VoucherVisitDateEditor({ voucherId, expiresAt }: props) {
  const utils = api.useUtils();
  const [open, setOpen] = React.useState(false);
  const currentDay = parse(getBrazilDateKey(expiresAt), DATE_KEY_FORMAT, new Date());
  const [selected, setSelected] = React.useState<Date | undefined>(currentDay);

  const mutation = api.voucher.updateVisitDate.useMutation({
    onSuccess: async (voucher) => {
      toast({
        title: `Data da visita alterada para ${format(selected ?? currentDay, "dd/MM/yyyy")}`,
      });
      setOpen(false);
      await Promise.all([
        utils.voucher.getAdminDetails.invalidate({ id: voucher.id }),
        utils.voucher.findAdminPage.invalidate(),
        utils.voucher.getTodayPage.invalidate(),
        utils.voucher.getTodaySummary.invalidate(),
        utils.voucher.getAdminVoucherSummary.invalidate(),
      ]);
    },
    onError: (error) => {
      toast({
        title: "Não foi possível alterar a data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected(currentDay);
  }

  const unchanged = !selected || format(selected, DATE_KEY_FORMAT) === format(currentDay, DATE_KEY_FORMAT);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-auto gap-1 px-2 py-0.5 font-semibold">
          <CalendarIcon className="h-4 w-4" />
          {formatDateWeekDay(expiresAt)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} defaultMonth={currentDay} onSelect={setSelected} initialFocus />
        <div className="flex justify-end gap-2 border-t p-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={unchanged || mutation.isPending}
            onClick={() => selected && mutation.mutate({ id: voucherId, date: format(selected, DATE_KEY_FORMAT) })}
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
