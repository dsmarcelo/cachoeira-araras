'use client' // Error components must be Client Components

import { useEffect } from 'react'
import ErrorCard from '../erro/error'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 gap-4">
      <ErrorCard title='Erro' message={error.message} />
      <Button
        variant="outline"
        onClick={() => reset()}
      >
        Tente novamente
      </Button>
    </div>
  )
}