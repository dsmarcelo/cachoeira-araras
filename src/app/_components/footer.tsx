import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaInstagram, FaLocationArrow, FaWhatsapp } from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className='flex flex-col gap-4 py-8 items-center bg-slate-800 text-primary-100 mt-8'>
      <h4>Cachoeira das Araras</h4>
      <div className='flex gap-8'>
        <Image src={"/logo_cda.png"} alt='logo cachoeira' width={100} height={100} />
        <div className='flex flex-col gap-2'>
          <Link href={"https://www.instagram.com/cachoeiradasararasoficial/"} target='_blank' className='flex gap-2 items-center'>
            <FaInstagram className='mt-1' />
            <p>Instagram</p>
          </Link>
          <Link href={"https://wa.me/556299251040"} target='_blank' className='flex gap-2 items-center'>
            <FaWhatsapp className='mt-1' />
            <p>Whatsapp</p>
          </Link>
          <Link href={"https://maps.app.goo.gl/BUrzJgESTCBrFfhG8"} target='_blank' className='flex gap-2 items-center'>
            <FaLocationArrow className='mt-1' />
            <p>Localização</p>
          </Link>
        </div>
      </div>
    </footer>
  )
}
