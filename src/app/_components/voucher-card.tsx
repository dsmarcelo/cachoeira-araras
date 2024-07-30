import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formateDateDayMonthYear } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { formatVoucherStatus } from '@/lib/voucher'
import { type Voucher } from '@prisma/client'
import Image from 'next/image'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {

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

  function truncateName(name: string,): string {
    const maxLength = 35
    if (name.length > maxLength) {
      return name.slice(0, maxLength - 3) + '...';
    }
    return name;
  }

  return (
    <div className='w-[400px] relative max-w-3xl aspect-[2/1] text-bg-blue mx-auto bg-[url(/voucher_card.png)] bg-cover scale-75 min-[375px]:scale-90 min-[428px]:scale-100 -translate-y-8 sm:scale-125 sm:translate-y-[20px] md:scale-150 md:translate-y-1/4'>
      <div className='relative top-12 left-4 flex flex-col gap-1 font-semibold'>
        <p>{truncateName(data.name)}</p>
        <p>{formatPhone(data.phone)}</p>
        <p>{formatQuantity({ adults: data.adults, elderly: data.elderly })}</p>
        {data.status !== 'valid' ? <p className='w-fit'>{formatVoucherStatus(data.status)}</p>
          : <p>Valido até: {data.expires_at ? formateDateDayMonthYear(data.expires_at) : 'Não informado'}</p>
        }
      </div>
      {/* <h3 className='relative -bottom-[42px] left-[144px] text-2xl font-bold text-center'>{data.code}</h3> */}
      <h3 className='absolute w-fit bottom-0 right-0 mr-[26px] mb-[18px] text-2xl font-bold text-center'>{data.code}</h3>
    </div>
  )
}
