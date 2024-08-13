'use client'
import Link from 'next/link'
import React from 'react'
import { MdError } from 'react-icons/md'
import { HomeIcon } from "lucide-react"

export default function ErrorCard({ title, message, children, className, variant, light }:
  { title?: string, message?: string, children?: React.ReactNode, className?: string, variant?: 'home' | '404' | '500', light?: boolean }) {
  return (
    <div className={`p-4 max-w-lg mx-auto flex flex-col gap-4 justify-center rounded-2xl items-center ${className} ${light ? 'text-bg-blue' : 'text-light'}`}>
      <div className="flex items-center font-semibold ">
        <MdError className='absolute w-10 h-10 mr-2 -translate-x-11 translate-y-1' />
        <h3 className='text-5xl'>{title}</h3>
      </div>
      <h4 className="text-xl">{message}</h4>
      <div className="">
        {children}
      </div>
      {variant === 'home' &&
        <div className=''>
          <Link href={'/'} className="rounded-xl shadow-md flex items-center bg-dark-blue p-4 hover:bg-slate-600">
            <HomeIcon className='mr-2 w-4 h-4' />
            <p>Retornar ao Início</p>
          </Link>
        </div>
      }
    </div>
  )
}
