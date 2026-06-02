"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function MobileHeader() {
  return (
    <div className="md:hidden flex items-center gap-3 ml-auto">
      <Link href="/" className="flex-shrink-0">
        <Image
          src="/logo_nome.png"
          alt="logo"
          width={96}
          height={76}
          className="h-auto w-[96px]"
          style={{ height: "auto" }}
          priority
        />
      </Link>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="shrink-0 bg-transparent text-current hover:bg-bg-blue/20"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetClose asChild>
            <Link href="/" className="mb-8 flex flex-col">
              <Image
                src="/logo_nome.png"
                alt="logo"
                width={96}
                height={76}
                className="h-auto w-[96px]"
                style={{ height: "auto" }}
                priority
              />
            </Link>
          </SheetClose>
          <nav className="grid gap-6 text-lg font-medium">
            <SheetClose asChild>
              <Link href="/" className="hover:text-foreground">
                Inicio
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link href="/galeria" className="hover:text-foreground">
                Fotos
              </Link>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
