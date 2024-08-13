import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'

export default async function AdminPage() {
  return (
    <main className='flex w-full flex-col items-center px-4'>
      <div className='mt-8'>
        <ValidateVoucher />
      </div>
    </main >
  )
}
