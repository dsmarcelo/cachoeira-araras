import Link from 'next/link'
import React from 'react'
import {
  Menu,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from '@/components/ui/button'
import Image from 'next/image';

export default function Header() {
  return (
    <header className="top-0 flex h-16 lg:h-24 items-center gap-4 border-b-primary-500 bg-dark-blue text-primary-400 px-4 md:px-6">
      {/* <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <div className='w-full flex flex-col'>
          <Image src="/logo_nome.png" alt="logo" className='' width={80} height={80} />
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base p-2 rounded-lg hover:bg-slate-100"
        >
          Inicio
        </Link>
      </nav> */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="shrink-0 bg-transparent text-current"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <Link href="/" className='flex flex-col mb-8'>
            <Image src="/logo_nome.png" alt="logo" className='' width={80} height={80} />
          </Link>
          <nav className="grid gap-6 text-lg font-medium">
            <Link href="/" className="hover:text-foreground">
              Inicio
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      <div className='w-full flex flex-col'>
        <Image src="/logo_nome.png" alt="logo" className='mx-auto' width={80} height={80} />
      </div>
      <Link
        href="https://wa.me/556299251040?"
        target='_blank'
        className="text-foreground ml-auto transition-colors p-2 rounded-lg hover:bg-slate-100"
      >
        <FaWhatsapp className="h-6 w-6" />
      </Link>
    </header>
  )
}
