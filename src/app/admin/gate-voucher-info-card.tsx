'use client'
import * as React from "react"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import Link from "next/link"

import { formatDateWeekDay, formateDate, formatPhone, formatReferrer, formatToBRL, truncateName } from "@/lib/utils"
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
import { formatVoucherStatus } from "@/lib/voucher"
import { Copy } from "lucide-react"
import { api as trpc } from "@/trpc/react"
import { formatPaymentStatus, formatPaymentStatusDetail, formatPaymentType } from "@/lib/mercadopago"
import { toast } from "@/components/ui/use-toast"
import { api } from "../../../convex/_generated/api"

type AdminGateVoucher = FunctionReturnType<typeof api.vouchers.listTodayAdmin>[number];

interface props {
  data: AdminGateVoucher,
  onClose: () => void
  open: boolean
}

/**
 * The admin gate card: today's-voucher list drawer, backed directly by
 * Convex (`listTodayAdmin`) rather than the Prisma-backed `VoucherInfoCard`
 * used by the all-vouchers table under /admin/tabela — that one stays on
 * tRPC until ticket 11 migrates it, so the two components are kept separate
 * rather than sharing a type that neither data source can satisfy.
 */
export function GateVoucherInfoCard({ data, onClose, open }: props) {
  function paymentInfo() {
    const { paymentId } = data
    if (!paymentId) return null

    const paymentInfo = trpc.mercadopago.getPayment.useQuery({ payment_id: paymentId })
    if (!paymentInfo) return null
    const payment = paymentInfo.data
    if (!payment) return null
    return (
      <div className="flex flex-col gap-1">
        <hr className="border-t border-gray-300 my-4" />
        <h2 className="font-semibold text-center">Detalhes do pagamento</h2>
        <div className="text-sm">
          {payment.status && <p>{formatPaymentStatus(payment.status)}</p>}
          {payment.status_detail && <p>{formatPaymentStatusDetail(payment.status_detail)}</p>}
          {payment.date_created && <div>
            <p>{`Criado em: ${formateDate(payment.date_created)}`}</p>
          </div>}
          {payment.date_approved && <p>{`Aprovado em: ${formateDate(payment.date_approved)}`}</p>}
          {payment.payment_method_id && <p>{`Tipo de pagamento: ${formatPaymentType(payment.payment_method_id)}`}</p>}
          <p>{payment.payer?.first_name}</p>
          <p onClick={() => navigator.clipboard.writeText(payment.payer?.email ?? '')}>{payment.payer?.email}</p>
          <div className="flex gap-1" onClick={() => navigator.clipboard.writeText(payment.payer?.identification?.number ?? '')}>
            <p>{payment.payer?.identification?.type}:</p>
            <p>{payment.payer?.identification?.number}</p>
          </div>
          {payment.transaction_amount && <div><span>Valor da compra: </span>{formatToBRL(payment.transaction_amount)}</div>}
        </div>
      </div>
    )
  }

  function formatQuantity(data: { adults: number; elderly: number; }): string {
    const adultsText = data.adults === 1 ? '1 inteira' : `${data.adults} inteiras`;
    const elderlyText = data.elderly === 1 ? '1 meia' : `${data.elderly} meias`;

    if (data.adults > 0 && data.elderly > 0) {
      return `${adultsText} e ${elderlyText}`;
    } else if (data.adults > 0) {
      return adultsText;
    } else if (data.elderly > 0) {
      return elderlyText;
    } else {
      return 'Nenhuma entrada';
    }
  }

  const redeemByCode = useMutation(api.vouchers.redeemByCode)
  const reactivate = useMutation(api.vouchers.reactivate)

  async function handleUseVoucher(code: string) {
    try {
      await redeemByCode({ code })
      toast({ title: "Voucher resgatado com sucesso" })
      onClose()
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Erro ao usar voucher",
        variant: "destructive",
      })
    }
  }
  async function handleActivateVoucher(code: string) {
    try {
      await reactivate({ code })
      toast({ title: "Voucher ativado com sucesso" })
      onClose()
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Erro ao ativar voucher",
        variant: "destructive",
      })
    }
  }

  const expiresAt = new Date(data.expiresAt)

  return (
    <Drawer open={open} onClose={onClose} preventScrollRestoration={true} shouldScaleBackground={true} >
      <DrawerContent>
        <DrawerHeader className="text-left max-h-[80dvh] overflow-y-scroll">
          <DrawerTitle onClick={() => navigator.clipboard.writeText(data.code ?? '')}>{`Voucher ${data.code}`}</DrawerTitle>
          <DrawerDescription className="hover:bg-slate-100 rounded-md" onClick={() => navigator.clipboard.writeText(data.paymentId ?? '')}>
            {data.paymentId ? `ID de pagamento: ${data.paymentId}` : 'Nenhum pagamento'}
          </DrawerDescription>
          <div className="flex flex-col gap-1">
            <h4 className="hover:bg-slate-100 rounded-md" onClick={() => navigator.clipboard.writeText(data.name)}>{truncateName(data.name)}</h4>
            <Link
              href={`https://wa.me/${data.phone}`}
              target="_blank"
              className="hover:bg-slate-100 rounded-md"
              onClick={() => navigator.clipboard.writeText(data.phone)}>
              {formatPhone(data.phone)}
            </Link>
            <p>{formatQuantity({ adults: data.adults, elderly: data.elderly })}</p>
            <h4>{formatVoucherStatus(data.status)}</h4>
            {<p>Gerado em: {formateDate(new Date(data.createdAt).toISOString())}</p>}
            {data.referrer && `Origem: ${formatReferrer(data.referrer.source)}`}
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
            <p className="text-xs text-slate-500">{`Preferencia do pagamento:`}</p>
            <p className="text-xs text-slate-500">{`${data.preferenceId}`}</p>
          </div>
          <div>
          </div>
          {data.paymentId ? paymentInfo() : null}
          <p className="text-xs text-center text-slate-500">Toque nos items acima para copiar
            <span className="text-slate-500"><Copy className="inline-block w-3 h-3 ml-1" /></span>
          </p>
        </DrawerHeader>
        <DrawerFooter className="grid grid-cols-3 gap-2 pt-2">
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DrawerClose>
          <Button variant="outline" onClick={() => handleUseVoucher(data.code)}>Usar voucher</Button>
          <Button variant="outline" onClick={() => handleActivateVoucher(data.code)}>Ativar voucher</Button>
        </DrawerFooter>
      </DrawerContent>
      <DrawerOverlay onClick={onClose} />
    </Drawer >
  )
}
