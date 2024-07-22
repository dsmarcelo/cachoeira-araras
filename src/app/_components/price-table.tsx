import React from 'react'

export default function PriceTable() {
  return (
    <div className='w-full flex flex-col items-center justify-center'>
      <h3 className='font-semibold py-2 uppercase'>Tabela de preços</h3>
      <div className='w-full px-4 flex flex-col gap-2 font-semibold py-2 bg-primary-900'>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>Adulto</p>
          </div>
          R$40,00
        </div>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>+60 e especiais</p>
          </div>
          R$20,00
        </div>
        <div className='w-full flex justify-between'>
          <div className='flex gap-2'>
            <p>Crianças até de 8 anos</p>
          </div>
          Grátis
        </div>
      </div>
      <h3 className='font-medium py-2 uppercase'>Entrada permitida entre 07h e 17h</h3>
    </div>
  )
}
