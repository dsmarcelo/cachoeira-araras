'use client'
import React from 'react'
import { deleteCookieVoucher } from '../lib'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function DeleteVoucherCookieBtn() {
  const router = useRouter()
  async function resetCookieVoucher() {
    await deleteCookieVoucher()
    return router.push('/')
  }

  return (
    <Button onClick={resetCookieVoucher}>Comprar outro voucher</Button>
  )
}
