'use client'
import React from 'react'
import { motion } from 'framer-motion'
import PriceTable from './price-table'
import VoucherForm from './voucher-form'

export default function VoucherBuy() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ margin: "-50px 0px -100px 0px" }}
      className='mx-auto w-full max-w-2xl bg-dark-blue rounded-xl overflow-hidden'
    >
      <motion.div
      >
        <PriceTable />
      </motion.div>
      <motion.div
      >
        <VoucherForm />
      </motion.div>
    </motion.div>
  )
}
