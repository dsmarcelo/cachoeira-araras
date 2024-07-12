import Link from 'next/link'
import React from 'react'
import {
  Menu,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <h3>(logo) Cachoeria das Araras</h3>
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base p-2 rounded-lg hover:bg-slate-100"
        >
          Inicio
        </Link>
        <Link
          href="/validar"
          className="text-foreground transition-colors p-2 rounded-lg hover:bg-slate-100"
        >
          Validar Codigo
        </Link>
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <div className='w-full flex flex-col text-lg font-semibold rounded-lg mb-8 p-4'>
            (logo) Cachoeira das Araras
          </div>
          <nav className="grid gap-6 text-lg font-medium">
            <Link href="/" className="hover:text-foreground">
              Inicio
            </Link>
            <Link href="/validar" className="hover:text-foreground">
              Validar Codigo
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      <h3 className='md:hidden mx-auto'>(logo) Cachoeria das Araras</h3>
      <Link
        href="https://wa.me/5562996434112?text=Ol%C3%A1,%20meu%20nome%20%C3%A9%20Jo%C3%A3o%20e%20comprei%20um%20voucher%20para%206%20pessoas,%20com%20o%20c%C3%B3digo:%206caj"
        target='_blank'
        className="text-foreground ml-auto transition-colors p-2 rounded-lg hover:bg-slate-100"
      >
        <FaWhatsapp className="h-6 w-6" />
      </Link>
    </header>
  )
}
