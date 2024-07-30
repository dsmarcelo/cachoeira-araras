import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'
import { VoucherTable } from './voucher-table'
import { api } from '@/trpc/server'
import { columns } from "./columns"
import { type VoucherSchema } from '@/lib/voucher/types'
import PasswordLoginForm from '../_components/passwordLoginForm'
import { isLoggedIn, logout } from '../lib'

const fetchVouchers = async (): Promise<VoucherSchema[]> => {
  try {
    const vouchers = await api.voucher.findAll();
    return vouchers;
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    throw error;
  }
};

export default async function ValitadePage() {
  const isAdmin = await isLoggedIn();
  if (!isAdmin) {
    return <PasswordLoginForm />
  }
  const vouchers = await fetchVouchers()

  return (
    <main className='flex min-h-screen w-full flex-col items-center px-4'>
      <form action={async () => {
        'use server'
        await logout()
      }}
      >
        <button type='submit' className='right-0 absolute'>Sair</button>
      </form>
      <div className='mt-12'>
        <ValidateVoucher />
      </div>
      <div className='w-full mx-auto my-36'>
        <VoucherTable columns={columns} data={vouchers} />
      </div>
    </main >
  )
}
