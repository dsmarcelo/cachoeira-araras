import React from 'react'
import PriceTable from './price-table'
import TestVoucherForm from './voucher-form-test'

export default function TestVoucherBuy() {
  return (
    <div className='mx-auto w-full max-w-2xl bg-dark-blue rounded-xl overflow-hidden'>
      <PriceTable />
      <TestVoucherForm />
    </div>
  )
}
