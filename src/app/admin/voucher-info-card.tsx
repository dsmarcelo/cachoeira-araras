'use client'
import * as React from "react"

import { cn, formateDate, formatPhone, formatToBRL } from "@/lib/utils"
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
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Row } from "@tanstack/react-table"
import { VoucherSchema } from "@/lib/voucher/types"
import { formatVoucherStatus, truncateName } from "@/lib/voucher"
import { Copy } from "lucide-react"
import { api } from "@/trpc/react"
import { formatPaymentStatus, formatPaymentStatusDetail, formatPaymentType } from "@/lib/mercadopago"

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
    <Drawer open={open} onClose={onClose} preventScrollRestoration={true} shouldScaleBackground={true} >
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
      <DrawerOverlay onClick={onClose} />
    </Drawer >
  )
}

