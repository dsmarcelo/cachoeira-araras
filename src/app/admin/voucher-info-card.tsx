'use client'
import * as React from "react"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { formatDateWeekDay, formatReferrer, formatToBRL, getErrorMessage } from "@/lib/utils"
import { getSaoPauloDateKey } from "@/lib/utils/date"
import { getVisitDateRejection } from "@/lib/voucher/visit-date"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { api } from "../../../convex/_generated/api"
import { isAdminReschedulable } from "../../../convex/lib/voucherReschedule"
import { AdminVoucherRefundButton } from "./admin-voucher-refund-button"
import { VoucherImage, canShowVoucherImage } from "./_components/voucher-image"
import { DetailList, describeEntries, voucherStatusMeta } from "./_components/admin-ui"
import {
  VoucherSheet,
  WhatsAppLink,
  describeValidity,
  secondaryActionClass,
} from "./_components/voucher-sheet"

export type AdminVoucher = FunctionReturnType<typeof api.vouchers.listAdmin>["page"][number]

const correctableStatuses = ["pending", "valid", "redeemed", "expired", "refunded"] as const

/**
 * The admin all-vouchers table's drawer (`/admin/tabela`), backed directly
 * by Convex. Distinct from `GateVoucherInfoCard` (today-only gate list) and
 * `EmployeeVoucherInfoCard` (employee session, no payment details): this one
 * is admin-only, shows referrer attribution, and is the one place a status
 * can be corrected or a soft-deleted voucher restored. Vouchers are never
 * deleted from here: every record stays in the system.
 */
export function VoucherInfoCard({
  data,
  isDeleted,
  onClose,
  open,
}: {
  data: AdminVoucher
  /** Whether `data` came from the soft-deleted view — shows "Restaurar". */
  isDeleted: boolean
  onClose: () => void
  open: boolean
}) {
  const updateStatus = useMutation(api.vouchers.updateStatus)
  const restore = useMutation(api.vouchers.restore)
  const reschedule = useMutation(api.vouchers.rescheduleByAdmin)
  const [pendingStatus, setPendingStatus] = React.useState(data.status)
  const [pendingVisitDate, setPendingVisitDate] = React.useState(data.visitDate)
  const [isPending, startTransition] = React.useTransition()

  React.useEffect(() => {
    setPendingStatus(data.status)
  }, [data.status])

  React.useEffect(() => {
    setPendingVisitDate(data.visitDate)
  }, [data.visitDate])

  function handleSaveStatus() {
    if (pendingStatus === data.status) return
    startTransition(async () => {
      try {
        await updateStatus({ code: data.code, status: pendingStatus })
        toast({ title: "Status atualizado com sucesso" })
      } catch (error) {
        toast({ title: getErrorMessage(error, "Erro ao atualizar status"), variant: "destructive" })
      }
    })
  }

  function handleReschedule() {
    if (pendingVisitDate === data.visitDate) return
    startTransition(async () => {
      try {
        await reschedule({ code: data.code, visitDate: pendingVisitDate })
        toast({ title: "Data da visita alterada com sucesso" })
      } catch (error) {
        toast({ title: getErrorMessage(error, "Erro ao alterar a data da visita"), variant: "destructive" })
      }
    })
  }

  function handleRestore() {
    startTransition(async () => {
      try {
        await restore({ code: data.code })
        toast({ title: "Voucher restaurado com sucesso" })
        onClose()
      } catch (error) {
        toast({ title: getErrorMessage(error, "Erro ao restaurar voucher"), variant: "destructive" })
      }
    })
  }

  const canReschedule = !isDeleted && isAdminReschedulable(data.status)

  return (
    <VoucherSheet
      code={data.code}
      status={data.status}
      open={open}
      onClose={onClose}
      actions={
        isDeleted ? (
          <button type="button" className={secondaryActionClass} disabled={isPending} onClick={handleRestore}>
            Restaurar voucher
          </button>
        ) : undefined
      }
    >
      <DetailList
        rows={[
          { label: "Nome", value: data.name, copy: data.name },
          { label: "WhatsApp", value: <WhatsAppLink phone={data.phone} />, copy: data.phone },
          { label: "Entradas", value: describeEntries(data) },
          { label: "Visita", value: formatDateWeekDay(parseISO(data.visitDate)) },
          { label: "Validade", value: describeValidity(data.expiresAt) },
          ...(data.rescheduledAt !== undefined && data.rescheduledBy
            ? [{
                label: "Data alterada",
                value: `${data.rescheduledBy.kind === "customer" ? "Cliente" : data.rescheduledBy.username} em ${new Date(data.rescheduledAt).toLocaleString("pt-BR")}`,
              }]
            : []),
          { label: "Gerado em", value: formatDateWeekDay(new Date(data.createdAt)) },
          { label: "Origem", value: data.referrer ? formatReferrer(data.referrer.source) : "—" },
          { label: "Pagamento", value: data.paymentId ?? "Nenhum pagamento", copy: data.paymentId ?? null },
          ...(data.paymentIssue
            ? [
                {
                  label: "Situação do pagamento",
                  value: `${data.paymentIssue.kind === "dispute" ? "Pagamento contestado" : "Reembolso parcial"} (${data.paymentIssue.status}${data.paymentIssue.statusDetail ? `, ${data.paymentIssue.statusDetail}` : ""})`,
                },
                {
                  label: "Sinalizado em",
                  value: new Date(data.paymentIssue.notedAt).toLocaleString("pt-BR"),
                },
                ...(data.paymentIssue.refundedCents !== undefined
                  ? [{ label: "Valor reembolsado", value: formatToBRL(data.paymentIssue.refundedCents / 100) }]
                  : []),
              ]
            : []),
          ...(data.reversal && data.status !== "refunded"
            ? [{
                label: "Estorno",
                value: `${data.reversal.reason} em ${new Date(data.reversal.notedAt).toLocaleString("pt-BR")}`,
              }]
            : []),
          { label: "Preferência", value: data.preferenceId, copy: data.preferenceId },
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Corrigir status</span>
        <div className="flex gap-2">
          <Select
            value={pendingStatus}
            onValueChange={(value) => setPendingStatus(value as AdminVoucher["status"])}
          >
            <SelectTrigger className="h-11 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {correctableStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {voucherStatusMeta[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className={`${secondaryActionClass} px-4`}
            disabled={isPending || pendingStatus === data.status}
            onClick={handleSaveStatus}
          >
            Salvar
          </button>
        </div>
      </div>

      {canReschedule ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Alterar data da visita</span>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={`${secondaryActionClass} flex-1 justify-start px-4`}>
                  {format(parseISO(pendingVisitDate), "PPP", { locale: ptBR })}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </button>
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
            <button
              type="button"
              className={`${secondaryActionClass} px-4`}
              disabled={isPending || pendingVisitDate === data.visitDate}
              onClick={handleReschedule}
            >
              Salvar
            </button>
          </div>
        </div>
      ) : null}

      {!isDeleted ? (
        <AdminVoucherRefundButton code={data.code} paymentId={data.paymentId} status={data.status} />
      ) : null}

      {!isDeleted && canShowVoucherImage(data.status) ? (
        <VoucherImage
          code={data.code}
          phone={data.phone}
          version={`${data.status}-${data.expiresAt}`}
        />
      ) : null}
    </VoucherSheet>
  )
}
