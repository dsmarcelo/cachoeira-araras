"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { format, parseISO } from "date-fns";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import { getSaoPauloDateKey } from "@/lib/utils/date";
import { getVisitDateRejection } from "@/lib/voucher/visit-date";

/**
 * "Alterar data" flow for a customer's Pending or Valid voucher: pick a day on
 * a calendar limited by the same Visit Date rule as a purchase, then confirm.
 * The server re-checks every rule; its readable error is shown in the dialog.
 */
export function RescheduleVoucherDialog({
  lookupToken,
  visitDate,
}: {
  lookupToken: string;
  visitDate: string;
}) {
  const settings = useQuery(api.settings.getAll);
  const reschedule = useMutation(api.vouchers.rescheduleByCustomer);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(visitDate);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(visitDate);
      setError(null);
    }
  }

  async function handleConfirm() {
    try {
      setIsSaving(true);
      setError(null);
      await reschedule({ lookupToken, visitDate: selected });
      setOpen(false);
    } catch (caught) {
      setError(
        getErrorMessage(
          caught,
          "Não foi possível alterar a data agora. Tente novamente em instantes.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="inverseOutline">Alterar data</Button>
      </DialogTrigger>
      <DialogContent className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Alterar data da visita</DialogTitle>
          <DialogDescription>
            Escolha o novo dia e confirme. O voucher passa a valer somente
            nesse dia.
          </DialogDescription>
        </DialogHeader>
        {settings === undefined ? (
          <p>Carregando datas disponíveis...</p>
        ) : (
          <Calendar
            className="mx-auto"
            mode="single"
            selected={parseISO(selected)}
            onSelect={(date) =>
              date && setSelected(format(date, "yyyy-MM-dd"))
            }
            defaultMonth={parseISO(selected)}
            disabled={(date) =>
              getVisitDateRejection(format(date, "yyyy-MM-dd"), {
                todayKey: getSaoPauloDateKey(),
                rules: {
                  maxIntendedDays: settings["max.intended.days"],
                  disabledDays: settings["disabled.days"],
                },
              }) !== null
            }
          />
        )}
        {error && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button
            disabled={isSaving || selected === visitDate}
            onClick={() => void handleConfirm()}
          >
            {isSaving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
