import React from 'react'
import { getVoucherPrice, getElderlyVoucherPrice, getPoolVoucherPrice, getPoolElderlyVoucherPrice } from '@/lib/utils/utils'

export default function PriceTable() {
  const voucherPrice = getVoucherPrice();
  const elderlyPrice = getElderlyVoucherPrice();
  const poolVoucherPrice = getPoolVoucherPrice();
  const poolElderlyPrice = getPoolElderlyVoucherPrice();

  return (
    <div className='w-full flex flex-col items-center justify-center'>
      <h3 className='font-bold text-xl py-2 h-12 text-primary-100'>Adquira já seu voucher</h3>
      <div className='w-full flex flex-col gap-2 font-semibold pt-1 pb-2 bg-secondary text-primary-50'>
        <div className="w-full h-10 bg-dark-blue flex items-center justify-center ">
          <p className='text-primary-50 font-semibold text-lg'>Day use (Cachoeira + Bar Pé de Serra)</p>
        </div>
        <div className='w-full flex flex-col gap-2 px-4 '>
          <div className='w-full flex justify-between'>
            <div className='flex gap-2'>
              <p>Inteira (de 9 a 59 anos)</p>
            </div>
            R${voucherPrice.toFixed(2).replace('.', ',')}
          </div>
          <div className="w-full flex justify-between">
            <div className="flex gap-2">
              <p>Meia (+60 e especiais)</p>
            </div>
            R${elderlyPrice.toFixed(2).replace('.', ',')}
          </div>
          <div className="w-full flex justify-between">
            <div className="flex gap-2">
              <p>Crianças até 8 anos</p>
            </div>
            Grátis
          </div>
        </div>
        <div className="w-full h-10 bg-dark-blue flex items-center justify-center ">
          <p className='text-primary-50 font-semibold text-lg'>Day Use + Acesso a piscina</p>
        </div>
        <div className='w-full flex flex-col gap-2 px-4'>
          <div className='w-full flex justify-between'>
            <div className='flex gap-2'>
              <p>Inteira (de 9 a 59 anos)</p>
            </div>
            R${poolVoucherPrice.toFixed(2).replace('.', ',')}
          </div>
          <div className='w-full flex justify-between'>
            <div className='flex gap-2'>
            <p>Meia (+60 e especiais)</p>
            </div>
            R${poolElderlyPrice.toFixed(2).replace('.', ',')}
          </div>
          <div className="w-full flex justify-between">
            <div className="flex gap-2">
              <p>Crianças até 8 anos</p>
            </div>
            Grátis
          </div>
        </div>
      </div>
    </div>
  )
}
