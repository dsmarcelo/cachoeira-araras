import React from 'react'
export default function PaymentApprovedPage({ params }: { params: { slug: string } }) {

  console.log(`params ${params.slug}`)
  return (
    <div>
      <h1>Pagamento aprovado</h1>
      {params.slug}
    </div>
  )
}
