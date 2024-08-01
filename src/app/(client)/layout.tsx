import React from 'react'
import Header from '../_components/header'
import Footer from '../_components/footer'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto_1fr_auto]">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
