import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formateDateDayMonthYear } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { formatVoucherStatus } from '@/lib/voucher'
import { type Voucher } from '@prisma/client'
import Image from 'next/image'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {
  interface Data {
    adults: number;
    elderly: number;
  }

  function formatQuantity(data: Data): string {
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
    // <Card className='mx-auto w-full max-w-lg bg-cyan-950 text-white'>
    //   <CardHeader>
    //     <CardTitle>Voucher Para Cachoeira das Araras</CardTitle>
    //   </CardHeader>
    //   <CardContent className='flex flex-col gap-2'>
    //     <CardContent className='bg-sky-200 p-4 rounded-lg'>
    //       <h1 className='font-bold text-center text-black text-xl'>Codigo: {data.code}</h1>
    //     </CardContent>
    //     <h4>Status: {formatVoucherStatus(data.status)}</h4>
    //     <h4>Nome: {data.name}</h4>
    //     <h4>Pessoas com mais de 8 anos: {data.adults}</h4>
    //     <h4>Mais de 60 anos ou especiais: {data.elderly}</h4>
    //     <h4>Telefone: {formatPhone(data.phone) || 'Não informado'}</h4>
    //     <h4>Voucher: {data.valid ? 'Válido' : 'Inválido'}</h4>
    //     <h4>Expira em: {data.expires_at ? formateDateDayMonthYear(data.expires_at) : 'Não informado'}</h4>
    //   </CardContent>
    // </Card>
    <div className='w-[400px] max-w-3xl aspect-[2/1] text-bg-blue mx-auto bg-[url(/voucher_card.png)] bg-cover'>
      <div className='relative top-12 left-4 flex flex-col gap-1 font-semibold'>
        <p>{truncateName(data.name)}</p>
        <p>{formatPhone(data.phone)}</p>
        <p>{formatQuantity({ adults: data.adults, elderly: data.elderly })}</p>
        {data.status !== 'valid' ? <p className='text-bg-blue'>{formatVoucherStatus(data.status)}</p>
          : <p>Valido até: {data.expires_at ? formateDateDayMonthYear(data.expires_at) : 'Não informado'}</p>
        }
      </div>
      <h3 className='relative -bottom-[42px] left-[144px] text-2xl font-bold text-center'>{data.code}</h3>
    </div>
  )
}
