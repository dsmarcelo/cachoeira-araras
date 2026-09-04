import Link from 'next/link'
import React from 'react'

export default function AdminFooter() {
  return (
    <footer className="flex items-center justify-center border-t border-border bg-background py-2 px-4">
      <Link
        href="https://wa.me/5562996434112"
        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Entre em contato com o desenvolvedor
      </Link>
    </footer>
  );
}
