import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formateDateDayMonthYear, truncateName } from '@/lib/utils'
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

  const { name, phone, adults, elderly, status, expires_at, code } = data;

  // Crie a string de query parameters
  // const queryParams = `?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&adults=${adults}&elderly=${elderly}&status=${status}&code=${code}`;
  const queryParams = `?name=${phone}`;
  // const imgURL = `http://localhost:3000/api/og${queryParams}`
  // const imgURL = `http://localhost:3000/api/og?name=${encodeURIComponent(name)}&phone=${phone}&adults=${adults}&elderly=${elderly}&status=${status}&code=${code}`
  const imgURL = `http://localhost:3000/api/og?name=Maria%20Aparecida%20Silva&phone=619999999999&adults=1&elderly=0&status=valid&code=f22m`

  console.log('🚀 ~ VoucherCard ~ imgURL:', imgURL);
  return (
    // <div className='w-[400px] relative max-w-3xl aspect-[2/1] text-bg-blue mx-auto bg-[url(/voucher_card.png)] bg-cover scale-75 min-[375px]:scale-90 min-[428px]:scale-100 -translate-y-8 sm:scale-125 sm:translate-y-[20px] md:scale-150 md:translate-y-1/4'>
    //   <div className='relative top-12 left-4 flex flex-col gap-1 font-semibold'>
    //     <p>{truncateName(data.name)}</p>
    //     <p>{formatPhone(data.phone)}</p>
    //     <p>{formatQuantity({ adults: data.adults, elderly: data.elderly })}</p>
    //     {data.status !== 'valid' ? <p className='w-fit'>{formatVoucherStatus(data.status)}</p>
    //       : <p>Valido até: {data.expires_at ? formateDateDayMonthYear(data.expires_at) : 'Não informado'}</p>
    //     }
    //   </div>
    //   {/* <h3 className='relative -bottom-[42px] left-[144px] text-2xl font-bold text-center'>{data.code}</h3> */}
    //   <h3 className='absolute w-fit bottom-0 right-0 mr-[26px] mb-[18px] text-2xl font-bold text-center'>{data.code}</h3>
    // </div>
    <div>
      <Image src={imgURL} width={400} height={400} alt='Voucher' />
    </div>
  )
}
