'use client'
import { logout } from '@/app/lib'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { usePathname } from 'next/navigation';

export default function AdminHeader() {
  const pathname = usePathname();

  const navClasses = (path: string) =>
    pathname === path ? 'bg-white' : 'bg-none text-slate-400 hover:bg-slate-200 hover:text-slate-700'

  return (
    <header className='h-12 bg-slate-100 border-b flex justify-between items-center px-4 md:px-6'>
      <div className='w-12'>
        <Image src="/logo_nome.png" alt="logo" className='invert brightness-75' width={80} height={80} />
      </div>
      <nav className='grid grid-cols-2 w-48 font-medium text-sm mx-auto'>
        <Link href="/admin" className='w-full text-center'>
          <p className={`${navClasses('/admin')} p-2 rounded-sm`}>Validar</p>
        </Link>
        <Link href="/admin/tabela" className='w-full text-center'>
          <p className={`${navClasses('/admin/tabela')} p-2 rounded-sm`}>Tabela</p>
        </Link>
      </nav>
      <form className='w-12 flex justify-end' action={async () => {
        await logout()
      }}
      >
        <Button variant={'ghost'} type='submit' className='text-sm text-slate-400 p-0'>Sair</Button>
      </form>
    </header>
  )
}
