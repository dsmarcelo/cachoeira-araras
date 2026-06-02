import Link from "next/link";
import React from "react";
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import Image from "next/image";
import MobileHeader from "./mobile-header";

export default function Header() {
  return (
    <header className="top-0 max flex h-16 items-center gap-4 border-b-primary-500 bg-dark-blue px-4 text-primary-400 md:h-24 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center">
        <nav className="z-10 hidden gap-1 text-lg font-medium md:flex md:flex-row md:items-center">
          <Link href="/" className="mr-8 flex w-full flex-col">
            <Image
              src="/logo_nome.png"
              alt="logo"
              width={100}
              height={80}
              priority
              className="h-auto w-[100px]"
              style={{ height: "auto" }}
            />
          </Link>
          <Link
            href="/"
            className="flex items-center whitespace-nowrap gap-2 rounded-lg p-2 px-3 font-semibold hover:bg-bg-blue/20 md:text-base"
          >
            Inicio
          </Link>
          <Link
            href="/galeria"
            className="flex items-center whitespace-nowrap gap-2 rounded-lg p-2 px-3 font-semibold hover:bg-bg-blue/20 md:text-base"
          >
            Fotos
          </Link>
        </nav>
        <MobileHeader />
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href={"https://www.facebook.com/C.Araras/?locale=pt_BR"}
            target="_blank"
            className="flex h-12 w-12 items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-bg-blue/20"
          >
            <FaFacebook className="h-5 w-5" />
          </Link>
          <Link
            href={"https://www.instagram.com/cachoeiradasararasoficial/"}
            target="_blank"
            className="flex h-12 w-12 items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-bg-blue/20"
          >
            <FaInstagram className="h-5 w-5" />
          </Link>
          <Link
            href="https://wa.me/556299251040?"
            target="_blank"
            className="flex h-12 w-12 items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-bg-blue/20"
          >
            <FaWhatsapp className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
