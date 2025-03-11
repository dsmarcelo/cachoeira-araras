import React from 'react'
import TodayVouchers from '../_components/today-vouchers'

export default async function TodayPage() {
  return (
    <main className='flex w-full flex-col items-center px-4'>
      <div className='mt-8 w-full max-w-3xl'>
        <TodayVouchers />
      </div>
    </main>
  )
}
