import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaInstagram, FaLocationArrow, FaWhatsapp } from 'react-icons/fa'
import { MercadoPagoLogo } from './svg/mercado-pago'

export default function Footer() {
  return (
    <footer className='flex flex-col gap-4 py-8 items-center bg-slate-800 text-primary-100'>
      <h4>Cachoeira das Araras</h4>
      <div className='flex gap-8'>
        <div className='w-24 relative'>
          <Image src={"/logo_cda.png"} alt='logo cachoeira' className='object-contain' fill />
        </div>
        <div className='flex flex-col gap-1'>
          <Link href={"https://www.instagram.com/cachoeiradasararasoficial/"} target='_blank' className='flex gap-2 items-center hover:bg-slate-700 rounded-md p-1'>
            <FaInstagram className='mt-1' />
            <p>Instagram</p>
          </Link>
          <Link href={"https://wa.me/556299251040"} target='_blank' className='flex gap-2 items-center hover:bg-slate-700 rounded-md p-1'>
            <FaWhatsapp className='mt-1' />
            <p>Whatsapp</p>
          </Link>
          <Link href={"https://maps.app.goo.gl/BUrzJgESTCBrFfhG8"} target='_blank' className='flex gap-2 items-center hover:bg-slate-700 rounded-md p-1'>
            <FaLocationArrow className='mt-1' />
            <p>Localização</p>
          </Link>
        </div>
      </div>
      <div className='flex gap-1 items-center'>
        <h4>Pagamento seguro com</h4>
        <Link href={"https://www.mercadopago.com.br/"} target='_blank'>
          <MercadoPagoLogo className='w-24 h-12' />
        </Link>
      </div>
    </footer>
  )
}
