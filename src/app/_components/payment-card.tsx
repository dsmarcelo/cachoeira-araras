import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formateDate } from '@/lib/utils';
import { type PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import React from 'react'

export default function PaymentCard({ data, payment_id }: { data: PreferenceResponse, payment_id: string }) {
  const items = data.items
  if (!items) return null
  return (
    <Card className='border-primary-500 w-full max-w-lg bg-dark-blue text-primary-50'>
      <CardHeader>
        <CardTitle>Obrigado pela compra!</CardTitle>
        <CardDescription className='text-primary-300'>
          Mostre o codigo de validação identificação na portaria!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>ID do pagamento: {payment_id}</p>
        {items.map((item, index) => (
          <div key={index}>
            <h2>{item.title}</h2>
            <p>Valor: R${Number(item.unit_price).toFixed(2).replace('.', ',')}</p>
          </div>
        ))}
      </CardContent>
      <CardContent>
        <p>{`Pedido feito em ${formateDate(data.date_created ?? "-")}`}</p>
      </CardContent>
    </Card>
  )
}
