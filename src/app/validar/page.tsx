import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'
import { VoucherTable } from './voucher-table'
import { api } from '@/trpc/server'
import { columns } from "./columns"
import { type Voucher } from '@/lib/voucher/types'

const fetchVouchers = async (): Promise<Voucher[]> => {
  try {
    const vouchers = await api.voucher.findAll();
    return vouchers;
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    throw error;
  }
};

export default async function ValitadePage() {
  const vouchers = await fetchVouchers();

  return (
    <main className='flex min-h-screen flex-col items-center justify-center px-4 py-24'>
      <ValidateVoucher />
      <div className='mt-36 w-full mx-auto'>
        <VoucherTable columns={columns} data={vouchers} />
      </div>
    </main>
  )
}
