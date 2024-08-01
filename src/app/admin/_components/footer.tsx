import Link from 'next/link'
import React from 'react'

export default function AdminFooter() {
  return (
    <footer className='bg-slate-100 border-t border-slate-200 flex justify-center items-center py-2 px-4'>
      <Link href="https://wa.me/5562996434112" className='text-blue-300 hover:underline'>Entre em contato com o desenvolvedor</Link>
    </footer>
  )
}
