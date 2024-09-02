'use client'
import { Button } from '@/components/ui/button'
import React from 'react'
import { deleteCookieVoucher } from '../lib'
import { FaArrowLeft } from 'react-icons/fa'
import { toast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

export default function VoucherCreatedCard(
  { code, init_point, redirectToPayment, setCode, payment_success_url }:
    { code: string, init_point: string, redirectToPayment: () => void, setCode: React.Dispatch<React.SetStateAction<string>>, payment_success_url: string }) {
  const router = useRouter()
  async function handleClick(showToast = true) {
    setCode('')
    await deleteCookieVoucher()
    if (showToast) {
      toast({
        title: 'Voucher deletado',
        description: 'Voucher deletado, por favor, tente novamente',
      })
    }
    return router.refresh()
  }

  if (!init_point) {
    return (
      <motion.div
        className='p-4'
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className='flex flex-col gap-6'>
          <p className='text-primary-100 font-medium'>Ocorreu um erro ao criar o voucher, por favor, volte e tente novamente</p>
          <Button onClick={() => handleClick(true)} className='mb-4 h-12 text-primary-50'>
            <FaArrowLeft className='mr-2 h-3 w-3' />
            <p>Voltar</p>
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className='p-4'
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button onClick={() => handleClick(true)} className='mb-4 h-8 bg-dark-blue text-primary-50'>
        <FaArrowLeft className='mr-2 h-3 w-3' />
        <p>Voltar</p>
      </Button>
      <div className='flex flex-col gap-6'>
        {payment_success_url ? (
          <div className='p-4'>
            <Button onClick={() => handleClick(false)} className='mb-4 h-8 bg-dark-blue text-primary-50'>
              <FaArrowLeft className='mr-2 h-3 w-3' />
              <p>Voltar</p>
            </Button>
            <p className='text-green-100 font-medium text-xl mb-4'>Ja recebemos seu pagamento, clique no botão abaixo para visualizar o voucher:</p>
            <Button className='bg-positive-green h-14 text-xl w-full' onClick={() => window.open(payment_success_url)}>Visualizar voucher</Button>
          </div>) : (
          <div className='flex flex-col gap-6'>
            <p className='text-primary-100 font-medium'>Voucher criado com sucesso! Guarde o codigo abaixo, finalize o pagamento clicando no botão abaixo e volte ao site para utiliza-lo:</p>
            <h2 className='text-7xl font-bold text-center text-primary-50'>{code}</h2>
            <Link href={init_point} className='bg-positive-green rounded-xl text-center h-14 text-xl w-full flex justify-center items-center font-medium text-primary-50' onClick={redirectToPayment}>
              <p className='translate-y-[-2px]'>Finalizar pagamento</p>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}
