'use client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import React from 'react'

export default function PendingPaymentCard({ paymentURL }: { paymentURL: string }) {
  const router = useRouter();
  return (
    <div className='mt-12 flex flex-col gap-4 mb-auto mx-auto max-w-xl'>
      Pagamento pendente, apos o pagamento, atualize a página
      <Button onClick={() => router.push(paymentURL)}>Clique aqui para finalizar o pagamento</Button>
    </div>
  )
}
