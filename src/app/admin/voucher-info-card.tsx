'use client'
import * as React from "react"

import { cn, formateDate, formatPhone } from "@/lib/utils"
// import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Row } from "@tanstack/react-table"
import { VoucherSchema } from "@/lib/voucher/types"
import { formatVoucherStatus } from "@/lib/voucher"
import { Copy } from "lucide-react"
import { api } from "@/trpc/react"

// export function openDrawer() {
//   setOpen(true)
// }

interface props {
  data: VoucherSchema
  onClose: () => void
  open: boolean
}

export function VoucherInfoCard({ data, onClose, open }: props) {
  // const [open, setOpen] = React.useState(false)
  // const isDesktop = useMediaQuery("(min-width: 768px)")

  function truncateName(name: string,): string {
    const maxLength = 35
    if (name.length > maxLength) {
      return name.slice(0, maxLength - 3) + '...';
    }
    return name;
  }

  function formatPaymentStatus(status: string): string {
    switch (status) {
      case 'approved':
        return 'Pagamento Aprovado';
      case 'pending':
      case 'in_process':
        return 'Pagamento Em andamento';
      case 'authorized':
        return 'Pagamento Autorizado';
      case 'rejected':
        return 'Pagamento Rejeitado';
      case 'cancelled':
        return 'Pagamento Cancelado';
      case 'refunded':
        return 'Pagamento Reembolsado';
      default:
        return 'Desconhecido';
    }
  }

  function formatPaymentStatusDetail(status: string): string {
    switch (status) {
      case 'accredited':
        return 'Pagamento creditado na conta';
      case 'pending_contingency':
        return 'Pagamento em processamento';
      case 'pending_review_manual':
        return 'Pagamento em analise manual';
      case 'cc_rejected_bad_filled_date':
        return 'Data de expiração incorreta';
      case 'cc_rejected_bad_filled_other':
        return 'Dados do cartão incorretos';
      case 'cc_rejected_bad_filled_security_code':
        return 'CVV incorreto';
      case 'cc_rejected_blacklist':
        return 'Cartão bloqueado';
      case 'cc_rejected_call_for_authorize':
        return 'Pagamento requer autorização';
      case 'cc_rejected_card_disabled':
        return 'Cartão desativado';
      case 'cc_rejected_duplicated_payment':
        return 'Pagamento duplicado';
      case 'cc_rejected_high_risk':
        return 'Pagamento rejeitado por prevenção de fraude';
      case 'cc_rejected_insufficient_amount':
        return 'Valor insuficiente';
      case 'cc_rejected_invalid_installments':
        return 'Número de parcelas inválido';
      case 'cc_rejected_max_attempts':
        return 'Excedido o número máximo de tentativas';
      case 'cc_rejected_other_reason':
        return 'Erro genérico';
      default:
        return 'Desconhecido';
    }
  }

  function paymentInfo() {
    const { payment_id } = data
    if (!payment_id) return null

    const paymentInfo = api.mercadopago.getPayment.useQuery({ payment_id })
    if (!paymentInfo) return null
    const payment = paymentInfo.data
    if (!payment) return null
    return (
      <div className="flex flex-col gap-1">
        <hr className="border-t border-gray-300 my-4" />
        <h2 className="font-semibold text-center">Detalhes do pagamento</h2>
        <div className="">
          {payment.status && <p>{formatPaymentStatus(payment.status)}</p>}
          {payment.status_detail && <p>{formatPaymentStatusDetail(payment.status_detail)}</p>}
          {payment.date_created && <div>
            <p>{`Criado em: ${formateDate(payment.date_created)}`}</p>
          </div>}
          {payment.date_approved && <p>{`Aprovado em: ${formateDate(payment.date_approved)}`}</p>}
          <p>{`Tipo de pagamento: ${payment.payment_method_id}`}</p>
          <p>{payment.payer?.first_name}</p>
          <p onClick={() => navigator.clipboard.writeText(payment.payer?.email ?? '')}>{payment.payer?.email}</p>
          <div className="flex gap-1" onClick={() => navigator.clipboard.writeText(payment.payer?.identification?.number ?? '')}>
            <p>{payment.payer?.identification?.type}:</p>
            <p>{payment.payer?.identification?.number}</p>
          </div>
        </div>
      </div>
    )
  }

  // if (isDesktop) {
  //   return (
  //     <Dialog open={open} onOpenChange={setOpen}>
  //       <DialogTrigger asChild>
  //         <Button variant="outline">Edit Profile</Button>
  //       </DialogTrigger>
  //       <DialogContent className="sm:max-w-[425px]">
  //         <DialogHeader>
  //           <DialogTitle>Edit profile</DialogTitle>
  //           <DialogDescription>
  //             Make changes to your profile here. Click save when you're done.
  //           </DialogDescription>
  //         </DialogHeader>
  //         <ProfileForm />
  //       </DialogContent>
  //     </Dialog>
  //   )
  // }

  return (
    <Drawer open={open} onClose={onClose} preventScrollRestoration={true} shouldScaleBackground={true}>
      {/* <DrawerTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DrawerTrigger> */}
      <DrawerContent>
        <DrawerHeader className="text-left max-h-[80dvh] overflow-y-scroll">
          <DrawerTitle onClick={() => navigator.clipboard.writeText(data.code ?? '')}>{`Voucher ${data.code}`}</DrawerTitle>
          <DrawerDescription className="hover:bg-slate-100 rounded-md" onClick={() => navigator.clipboard.writeText(data.payment_id ?? '')}>
            {`ID de pagamento: ${data.payment_id}`}
          </DrawerDescription>
          <div className="flex flex-col gap-1">
            <h4 className="hover:bg-slate-100 rounded-md" onClick={() => navigator.clipboard.writeText(data.name)}>{truncateName(data.name)}</h4>
            <h4 className="hover:bg-slate-100 rounded-md" onClick={() => navigator.clipboard.writeText(data.phone)}>{formatPhone(data.phone)}
            </h4>
            <h4>{formatVoucherStatus(data.status)}</h4>
          </div>
          <div className="flex flex-wrap gap-x-1" onClick={() => navigator.clipboard.writeText(data.preference_id)}>
            <p className="text-xs text-slate-500">{`Preferencia do pagamento:`}</p>
            <p className="text-xs text-slate-500">{`${data.preference_id}`}</p>
          </div>
          <div>
          </div>
          {data.payment_id ? paymentInfo() : null}
          <p className="text-xs text-center text-slate-500">Toque nos items acima para copiar
            <span className="text-slate-500"><Copy className="inline-block w-3 h-3 ml-1" /></span>
          </p>
        </DrawerHeader>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

