'use client'
import * as React from "react"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"

import { formatDateWeekDay, formatReferrer, getErrorMessage } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { api } from "../../../convex/_generated/api"
import { AdminVoucherRefundButton } from "./admin-voucher-refund-button"
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
  const [pendingStatus, setPendingStatus] = React.useState(data.status)
  const [isPending, startTransition] = React.useTransition()

  React.useEffect(() => {
    setPendingStatus(data.status)
  }, [data.status])

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
          { label: "Validade", value: describeValidity(data.expiresAt) },
          { label: "Gerado em", value: formatDateWeekDay(new Date(data.createdAt)) },
          { label: "Origem", value: data.referrer ? formatReferrer(data.referrer.source) : "—" },
          { label: "Pagamento", value: data.paymentId ?? "Nenhum pagamento", copy: data.paymentId ?? null },
          { label: "Preferência", value: data.preferenceId ?? "Sem preferência (pagamento no site)", copy: data.preferenceId ?? null },
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

      {!isDeleted ? (
        <AdminVoucherRefundButton code={data.code} paymentId={data.paymentId} status={data.status} />
      ) : null}
    </VoucherSheet>
  )
}
