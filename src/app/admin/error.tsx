'use client' // Error components must be Client Components

import { useEffect } from 'react'
import ErrorCard from '../erro/error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div>
      <ErrorCard title='Erro' message={error.message} light={true} />
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Tente novamente
      </button>
    </div>
  )
}