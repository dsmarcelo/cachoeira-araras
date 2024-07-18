import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formateDate } from '@/lib/utils';
import { type PreferenceSchema } from '@/lib/utils/mercadopago/types';
import React from 'react'

export default function PaymentCard({ data, payment_id }: { data: PreferenceSchema, payment_id: string }) {
  const items = data.items
  return (
    <Card className='border-green-500'>
      <CardHeader>
        <CardTitle>Obrigado pela compra!</CardTitle>
        <CardDescription>
          Mostre o codigo de validação identificação na portaria!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>ID do pagamento: {payment_id}</p>
      </CardContent>
      <CardContent>
        {items.map((item, index) => (
          <div key={index}>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <p>Valor: {item.unit_price}</p>
          </div>
        ))}
      </CardContent>
      <CardContent>
        <p>{`Pedido feito em ${formateDate(data.date_created)}`}</p>
      </CardContent>
    </Card>
  )
}
