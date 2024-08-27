'use client'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { FaInstagram, FaLocationArrow, FaWhatsapp } from 'react-icons/fa'
import { MercadoPagoLogo } from './svg/mercado-pago'
import { motion, useScroll } from 'framer-motion'

export default function Footer() {
  return (
    <motion.footer className='bg-slate-800'>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        viewport={{ once: true, margin: "0px 0px -100px 0px" }}
        className='flex flex-col gap-4 py-8 items-center text-primary-100'
      >
        <h4>Cachoeira das Araras</h4>
        <div className='flex gap-8'>
          <div className='w-24 relative'>
            <Image src={"/logo_cda.png"} alt='logo cachoeira' className='object-contain' fill sizes='96px' />
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
      </motion.div>
    </motion.footer>
  )
}
