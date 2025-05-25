import React from 'react'
import { getVoucherPrice, getElderlyVoucherPrice } from '@/lib/utils/utils'

export default function PriceTable() {
  const voucherPrice = getVoucherPrice();
  const elderlyPrice = getElderlyVoucherPrice();

  return (
    <div className='w-full flex flex-col items-center justify-center'>
      <h3 className='font-bold text-xl py-2 h-12 text-primary-100'>Adquira já seu voucher</h3>
      <div className='w-full px-4 flex flex-col gap-2 font-semibold py-2 bg-secondary text-primary-50'>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>Adulto</p>
          </div>
          R${voucherPrice.toFixed(2).replace('.', ',')}
        </div>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>+60 e especiais</p>
          </div>
          R${elderlyPrice.toFixed(2).replace('.', ',')}
        </div>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>Crianças até 8 anos</p>
          </div>
          Grátis
        </div>
      </div>
    </div>
  )
}
