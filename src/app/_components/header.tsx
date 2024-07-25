import Link from 'next/link'
import React from 'react'
import {
  Menu,
} from "lucide-react"
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from '@/components/ui/button'
import Image from 'next/image';

export default function Header() {
  return (
    <header className="top-0 max flex h-16 md:h-24 items-center gap-4 border-b-primary-500 bg-dark-blue text-primary-400 px-4 md:px-6">
      <div className='flex items-center w-full mx-auto max-w-5xl'>
        <nav className="hidden gap-4 text-lg font-medium md:flex md:flex-row md:items-center z-10">
          <div className='w-full flex flex-col mr-8'>
            <Image src="/logo_nome.png" alt="logo" className='' width={120} height={80} />
          </div>
          <Link
            href="/"
            className="flex items-center whitespace-nowrap gap-2 font-semibold md:text-base p-2 rounded-lg hover:bg-slate-100"
          >
            Inicio
          </Link>
          <Link
            href="/comprar"
            className="flex items-center whitespace-nowrap gap-2 font-semibold md:text-base p-2 rounded-lg hover:bg-slate-100"
          >
            Comprar voucher
          </Link>
          <Link
            href="/galeria"
            className="flex items-center whitespace-nowrap gap-2 font-semibold md:text-base p-2 rounded-lg hover:bg-slate-100"
          >
            Galeria
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="shrink-0 bg-transparent text-current hover:bg-primary-700 md:hidden z-10"
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
              <Link href="/comprar" className="hover:text-foreground">
                Comprar voucher
              </Link>
              <Link href="/galeria" className="hover:text-foreground">
                Fotos
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
        <div className='md:hidden mx-auto w-48 h-10 md:h-16 absolute'>
          <Image src="/logo_nome.png" alt="logo" className='object-contain' sizes='' fill />
        </div>
        <nav className='ml-auto flex gap-1 items-center'>
          <Link
            href={"https://www.facebook.com/C.Araras/?locale=pt_BR"}
            target='_blank'
            className='w-12 h-12 flex items-center justify-center text-foreground transition-colors p-2 rounded-lg hover:bg-primary-700'
          >
            <FaFacebook className='w-5 h-5' />
          </Link>
          <Link
            href={"https://www.instagram.com/cachoeiradasararasoficial/"}
            target='_blank'
            className='w-12 h-12 flex items-center justify-center text-foreground transition-colors p-2 rounded-lg hover:bg-primary-700'
          >
            <FaInstagram className='w-5 h-5' />
          </Link>
          <Link
            href="https://wa.me/556299251040?"
            target='_blank'
            className="w-12 h-12 flex items-center justify-center text-foreground transition-colors p-2 rounded-lg hover:bg-primary-700"
          >
            <FaWhatsapp className="w-5 h-5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
