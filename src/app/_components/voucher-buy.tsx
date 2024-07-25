import React from 'react'
import PriceTable from './price-table'
import VoucherForm from './voucher-form'

export default function VoucherBuy() {
  return (
    <div className='mx-auto w-full max-w-2xl bg-dark-blue rounded-xl overflow-hidden'>
      <PriceTable />
      <VoucherForm />
    </div>
  )
}
