import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { formateDate } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { formatVoucherStatus } from '@/lib/voucher'
import { type Voucher } from '@prisma/client'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {
  return (
    <Card className='mx-auto w-full max-w-lg bg-cyan-950 text-white'>
      <CardHeader>
        <CardTitle>Voucher Para Cachoeira das Araras</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        <CardContent className='bg-sky-200 p-4 rounded-lg'>
          <h1 className='font-bold text-center text-black text-xl'>Codigo: {data.code}</h1>
        </CardContent>
        <h4>Status: {formatVoucherStatus(data.status)}</h4>
        <h4>Nome: {data.name}</h4>
        <h4>Pessoas com mais de 8 anos: {data.adults}</h4>
        <h4>Mais de 60 anos ou especiais: {data.elderly}</h4>
        <h4>Telefone: {formatPhone(data.phone) || 'Não informado'}</h4>
        <h4>Voucher: {data.valid ? 'Válido' : 'Inválido'}</h4>
        {/* <h4>Codigo de pagamento: {data.expires_at && formateDate(data.expires_at)}</h4> */}
        {/* <h4>Codigo de pagamento: {data.expires_at}</h4> */}
      </CardContent>
    </Card>
  )
}
