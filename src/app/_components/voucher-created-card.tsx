import { Button } from '@/components/ui/button'
import React from 'react'
import { deleteCookieVoucher } from '../lib'
import { FaArrowLeft } from 'react-icons/fa'
import { toast } from '@/components/ui/use-toast'
import Link from 'next/link'

export default function VoucherCreatedCard(
  { code, init_point, redirectToPayment, setCode, payment_success_url }:
    { code: string, init_point: string, redirectToPayment: () => void, setCode: React.Dispatch<React.SetStateAction<string>>, payment_success_url: string }) {

  async function handleClick(showToast = true) {
    setCode('')
    await deleteCookieVoucher()
    if (showToast) {
      toast({
        title: 'Voucher deletado',
        description: 'Voucher deletado, por favor, tente novamente',
      })
    }
  }

  if (payment_success_url) {
    return (<div className='p-4'>
      <Button onClick={() => handleClick(false)} className='mb-4 h-8 bg-dark-blue text-primary-50'>
        <FaArrowLeft className='mr-2 h-3 w-3' />
        <p>Voltar</p>
      </Button>
      <p className='text-green-100 font-medium text-xl mb-4'>Ja recebemos seu pagamento, clique no botão abaixo para visualizar o voucher:</p>
      <Button className='bg-positive-green h-14 text-xl w-full' onClick={() => window.open(payment_success_url)}>Visualizar voucher</Button>
    </div>)
  }

  return (
    <div className='p-4'>
      <Button onClick={() => handleClick(true)} className='mb-4 h-8 bg-dark-blue text-primary-50'>
        <FaArrowLeft className='mr-2 h-3 w-3' />
        <p>Voltar</p>
      </Button>
      <div className='flex flex-col gap-6'>
        <p className='text-green-100 font-medium'>Voucher criado com sucesso, guarde o seu codigo e faça o pagamento para utiliza-lo:</p>
        <h2 className='text-7xl font-bold text-center text-primary-50'>{code}</h2>
        {init_point && <Link href={init_point} className='bg-positive-green rounded-xl text-center h-14 text-xl w-full flex justify-center items-center font-medium text-primary-50' onClick={redirectToPayment}>
          <p className='translate-y-[-2px]'>Finalizar pagamento</p>
        </Link>}
      </div>
    </div>
  )
}
