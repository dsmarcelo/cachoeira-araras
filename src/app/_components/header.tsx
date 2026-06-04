import Link from "next/link";
import React from "react";
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import Image from "next/image";

export default function Header() {
  return (
    <header className="top-0 max flex h-16 items-center gap-4 border-b-primary-500 bg-dark-blue px-4 text-primary-400 md:h-24 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="flex shrink-0">
          <Image
            src="/logo_nome.png"
            alt="logo"
            width={100}
            height={80}
            priority
            className="h-auto w-[80px] md:w-[100px]"
            style={{ height: "auto" }}
          />
        </Link>
        <nav className="flex shrink-0 items-center gap-1">
          <Link
            href={"https://www.facebook.com/C.Araras/?locale=pt_BR"}
            target="_blank"
            className="flex h-10 w-10 items-center justify-center rounded-lg p-2 text-current transition-colors hover:bg-bg-blue/20 md:h-12 md:w-12"
          >
            <FaFacebook className="h-5 w-5" />
          </Link>
          <Link
            href={"https://www.instagram.com/cachoeiradasararasoficial/"}
            target="_blank"
            className="flex h-10 w-10 items-center justify-center rounded-lg p-2 text-current transition-colors hover:bg-bg-blue/20 md:h-12 md:w-12"
          >
            <FaInstagram className="h-5 w-5" />
          </Link>
          <Link
            href="https://wa.me/556299251040?"
            target="_blank"
            className="flex h-10 w-10 items-center justify-center rounded-lg p-2 text-current transition-colors hover:bg-bg-blue/20 md:h-12 md:w-12"
          >
            <FaWhatsapp className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
