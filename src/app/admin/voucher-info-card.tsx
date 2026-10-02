'use client'
import * as React from "react"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import Link from "next/link"

import { formatDateWeekDay, formatPhone, formatReferrer, getErrorMessage, truncateName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatVoucherStatus } from "@/lib/voucher"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSaoPauloDateKey } from "@/lib/utils/date"
import { getVisitDateRejection } from "@/lib/voucher/visit-date"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Copy } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { api } from "../../../convex/_generated/api"
import { AdminVoucherRefundButton } from "./admin-voucher-refund-button"

export type AdminVoucher = FunctionReturnType<typeof api.vouchers.listAdmin>[number]

const statusOptions = [
  { value: "pending", label: "Aguardando pagamento" },
  { value: "valid", label: "Válido" },
  { value: "redeemed", label: "Resgatado" },
  { value: "expired", label: "Expirado" },
  { value: "refunded", label: "Estornado" },
] as const

/** Statuses an admin may reschedule; Expired returns to Valid. */
const reschedulableStatuses: ReadonlyArray<AdminVoucher["status"]> = ["pending", "valid", "expired"]

interface props {
  data: AdminVoucher
  /** Whether `data` came from the soft-deleted view — shows "Restaurar". */
  isDeleted: boolean
  onClose: () => void
  open: boolean
}

/**
 * The admin all-vouchers table's drawer (`/admin/tabela`), backed directly
 * by Convex. Distinct from `GateVoucherInfoCard` (today-only gate list) and
 * `EmployeeVoucherInfoCard` (employee session, no payment details): this one
 * is admin-only, shows referrer attribution, and is the one place a status
 * can be corrected or a soft-deleted voucher restored. Vouchers are never
 * deleted from here: every record stays in the system.
 */
export function VoucherInfoCard({ data, isDeleted, onClose, open }: props) {
  const updateStatus = useMutation(api.vouchers.updateStatus)
  const restore = useMutation(api.vouchers.restore)
  const reschedule = useMutation(api.vouchers.rescheduleByAdmin)
  const [pendingStatus, setPendingStatus] = React.useState(data.status)
  const [pendingVisitDate, setPendingVisitDate] = React.useState(data.visitDate)

  React.useEffect(() => {
    setPendingStatus(data.status)
  }, [data.status])

  React.useEffect(() => {
    setPendingVisitDate(data.visitDate)
  }, [data.visitDate])

  function formatQuantity(voucher: { adults: number; elderly: number }): string {
    const adultsText = voucher.adults === 1 ? '1 inteira' : `${voucher.adults} inteiras`;
    const elderlyText = voucher.elderly === 1 ? '1 meia' : `${voucher.elderly} meias`;

    if (voucher.adults > 0 && voucher.elderly > 0) {
      return `${adultsText} e ${elderlyText}`;
    } else if (voucher.adults > 0) {
      return adultsText;
    } else if (voucher.elderly > 0) {
      return elderlyText;
    } else {
      return 'Nenhuma entrada';
    }
  }

  async function handleSaveStatus() {
    if (pendingStatus === data.status) return
    try {
      await updateStatus({ code: data.code, status: pendingStatus })
      toast({ title: "Status atualizado com sucesso" })
    } catch (error) {
      toast({
        title: getErrorMessage(error, "Erro ao atualizar status"),
        variant: "destructive",
      })
    }
  }

  async function handleReschedule() {
    if (pendingVisitDate === data.visitDate) return
    try {
      await reschedule({ code: data.code, visitDate: pendingVisitDate })
      toast({ title: "Data da visita alterada com sucesso" })
    } catch (error) {
      toast({
        title: getErrorMessage(error, "Erro ao alterar a data da visita"),
        variant: "destructive",
      })
    }
  }

  async function handleRestore() {
    try {
      await restore({ code: data.code })
      toast({ title: "Voucher restaurado com sucesso" })
      onClose()
    } catch (error) {
      toast({
        title: getErrorMessage(error, "Erro ao restaurar voucher"),
        variant: "destructive",
      })
    }
  }

  const expiresAt = new Date(data.expiresAt)
  const createdAt = new Date(data.createdAt)
  const canReschedule = !isDeleted && reschedulableStatuses.includes(data.status)

  return (
    <Drawer open={open} onClose={onClose} preventScrollRestoration={true} shouldScaleBackground={true} >
      <DrawerContent>
        <DrawerHeader className="text-left max-h-[80dvh] overflow-y-scroll">
          <DrawerTitle onClick={() => navigator.clipboard.writeText(data.code ?? '')}>{`Voucher ${data.code}`}</DrawerTitle>
          <DrawerDescription className="hover:bg-muted rounded-md transition-colors" onClick={() => navigator.clipboard.writeText(data.paymentId ?? '')}>
            {data.paymentId ? `ID de pagamento: ${data.paymentId}` : 'Nenhum pagamento'}
          </DrawerDescription>
          <div className="flex flex-col gap-1">
            <h4 className="hover:bg-muted rounded-md transition-colors" onClick={() => navigator.clipboard.writeText(data.name)}>{truncateName(data.name)}</h4>
            {/* Opens the customer's own WhatsApp conversation in a new tab; the app never sends a message itself. */}
            <Link
              href={`https://wa.me/${data.phone}`}
              target="_blank"
              className="hover:bg-muted rounded-md w-fit transition-colors"
              onClick={() => navigator.clipboard.writeText(data.phone)}>
              {formatPhone(data.phone)}
            </Link>
            <p>{formatQuantity({ adults: data.adults, elderly: data.elderly })}</p>
            <h4>{formatVoucherStatus(data.status)}</h4>
            <p>Gerado em: {formatDateWeekDay(createdAt)}</p>
            <p>Visita: {formatDateWeekDay(parseISO(data.visitDate))}</p>
            {data.rescheduledAt !== undefined && data.rescheduledBy && (
              <p className="text-xs text-muted-foreground">
                Data alterada por {data.rescheduledBy.kind === "customer" ? "cliente" : data.rescheduledBy.username} em {new Date(data.rescheduledAt).toLocaleString("pt-BR")}
              </p>
            )}
            {data.referrer && <p>Origem: {formatReferrer(data.referrer.source)}</p>}
            <div className="flex flex-wrap gap-x-1">
              <span>
                {expiresAt.toDateString() === new Date().toDateString()
                  ? "Expira hoje"
                  : expiresAt > new Date(Date.now() + (1000 * 60 * 60 * 24))
                    ? "Expira em"
                    : "Expirou em"}:
              </span>
              <h4>{formatDateWeekDay(expiresAt)}</h4>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-1" onClick={() => navigator.clipboard.writeText(data.preferenceId)}>
            <p className="text-xs text-muted-foreground">{`Preferência do pagamento:`}</p>
            <p className="text-xs text-muted-foreground">{`${data.preferenceId}`}</p>
          </div>
          <div className="flex items-end gap-2 pt-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Corrigir status</span>
              <Select value={pendingStatus} onValueChange={(value) => setPendingStatus(value as AdminVoucher["status"])}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingStatus === data.status}
              onClick={handleSaveStatus}
            >
              Salvar
            </Button>
          </div>
          {canReschedule && (
            <div className="flex items-end gap-2 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Alterar data da visita</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-48 justify-start font-normal">
                      {format(parseISO(pendingVisitDate), "PPP", { locale: ptBR })}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-2xl p-0 shadow-lg" align="center">
                    <Calendar
                      mode="single"
                      selected={parseISO(pendingVisitDate)}
                      onSelect={(date) => date && setPendingVisitDate(format(date, "yyyy-MM-dd"))}
                      disabled={(date) =>
                        getVisitDateRejection(format(date, "yyyy-MM-dd"), { todayKey: getSaoPauloDateKey() }) !== null
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pendingVisitDate === data.visitDate}
                onClick={handleReschedule}
              >
                Salvar
              </Button>
            </div>
          )}
          {!isDeleted && (
            <AdminVoucherRefundButton code={data.code} paymentId={data.paymentId} status={data.status} />
          )}
          <p className="text-xs text-center text-muted-foreground">Toque nos items acima para copiar
            <span className="text-muted-foreground"><Copy className="inline-block w-3 h-3 ml-1" /></span>
          </p>
        </DrawerHeader>
        <DrawerFooter className="grid grid-cols-2 gap-2 pt-2">
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DrawerClose>
          {isDeleted && (
            <Button variant="outline" onClick={handleRestore}>Restaurar voucher</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
      <DrawerOverlay onClick={onClose} />
    </Drawer >
  )
}
