'use client'
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react';

export default function MoreVoucherFormInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full bg-secondary overflow-hidden">
      <motion.header
        className="flex justify-center items-center gap-2 p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.95 }} // Slight scale down effect on tap
      >
        <h3>{open ? "Fechar" : "Mais Informações"}</h3>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }} // Rotate the arrow icon
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </motion.header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.section
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: {
                opacity: 1, height: "auto",
                transition: { duration: 0.3, type: "spring", stiffness: 300, damping: 25 }
              },
              collapsed: { opacity: 0, height: 0 }
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-8 py-4 space-y-8">
              <ol className="list-disc pl-4 space-y-4">
                <li>Insira seus dados</li>
                <li>Clique no botão acima</li>
                <li>Anote o código e realize o pagamento</li>
                <li>Após o pagamento, volte para o site para visualizar seu voucher</li>
                <li>Envie o voucher para o WhatsApp da cachoeira das araras</li>
                <li>Depois é só apresentar o código do voucher na portaria para entrar</li>
              </ol>
              <p className='mx-auto text-center'>Válido por 30 dias após a compra</p></div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
