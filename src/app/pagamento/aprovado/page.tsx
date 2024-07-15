import React from 'react'

export default function PaymentApprovedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  // const queries = Object.fromEntries(searchParams);
  return (
    <div>
      <h1>Pagamento aprovado</h1>
      <p>Queries: {JSON.stringify(searchParams)}</p>
    </div>
  )
}
