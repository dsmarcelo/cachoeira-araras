import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'
import TodayVouchers from './_components/today-vouchers'

export default async function AdminPage() {
  return (
    <main className='grid grid-cols-1 sm:grid-cols-2 w-full items-center px-4 sm:gap-12 py-4 max-w-6xl mx-auto'>
      <ValidateVoucher />
      <TodayVouchers />
    </main>
  );
}
