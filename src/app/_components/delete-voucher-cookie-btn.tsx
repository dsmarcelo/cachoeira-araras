'use client'
import React from 'react'
import { deleteCookieVoucher } from '../lib'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function DeleteVoucherCookieBtn() {
  const router = useRouter()
  async function resetCookieVoucher() {
    await deleteCookieVoucher()
    return router.push('/')
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={"ghost"} className='w-full text-light rounded-full py-0 h-8'>Comprar outro voucher</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deseja deletar este voucher do seu navegador e comprar outro?</AlertDialogTitle>
          <AlertDialogDescription>
            Seu voucher continuara a funcionar, mas não será mais exibido no seu navegador.
            <p className='font-bold'>Tenha certeza que guardou o codigo do voucher antes de continuar.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={resetCookieVoucher}>Continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
// <Button className='rounded-full'>Comprar outro voucher</Button>
