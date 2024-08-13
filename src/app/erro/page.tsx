import React from 'react'
import ErrorCard from './error'

export default function ErrorPage() {
  return (
    <div className='w-full h-full flex flex-col justify-center items-center bg-bg-blue text-primary-50'>
      <ErrorCard variant='home' message="Não foi possível carregar a página."></ErrorCard>
    </div>
  )
}
