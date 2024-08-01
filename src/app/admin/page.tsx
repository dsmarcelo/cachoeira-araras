import React from 'react'
import ValidateVoucher from '../_components/validate-voucher'
import PasswordLoginForm from '../_components/passwordLoginForm'
import { isLoggedIn, logout } from '../lib'

export default async function AdminPage() {
  return (
    <main className='flex min-h-screen w-full flex-col items-center px-4'>
      <div className='mt-12'>
        <ValidateVoucher />
      </div>
    </main >
  )
}
