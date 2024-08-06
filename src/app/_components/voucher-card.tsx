import { formateDateDayMonthYear } from '@/lib/utils'
import { type Voucher } from '@prisma/client'
import Image from 'next/image'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {
  const { name, phone, adults, elderly, status, expires_at, code } = data;
  const formatedExpiredDate = expires_at ? formateDateDayMonthYear(expires_at) : '';

  const queryParams = `?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&adults=${adults}&elderly=${elderly}&expires_at=${encodeURIComponent(formatedExpiredDate)}&status=${status}&code=${code}`;
  const imgURL = `http://localhost:3000/api/og${queryParams}`

  return (
    <div>
      <Image className='rounded-lg' src={imgURL} width={400} height={400} alt='Voucher' />
    </div>
  )
}
