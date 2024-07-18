import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'
import { VoucherTable } from './voucher-table'
import { api } from '@/trpc/server'
import { columns } from "./columns"
import { type VoucherSchema } from '@/lib/voucher/types'
import PasswordLoginForm from '../_components/passwordLoginForm'
import { isLoggedIn, logout } from '../lib'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

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
    <main className='flex min-h-screen flex-col items-center px-4 mb-96'>
      <form action={async () => {
        'use server'
        await logout()
      }}
      >
        <button type='submit' className='right-0 absolute'>Sair</button>
      </form>
      <div className='mt-36'>
        <ValidateVoucher />
      </div>
      <div className='mt-36 w-full mx-auto'>
        <VoucherTable columns={columns} data={vouchers} />
      </div>
    </main >
  )
}
