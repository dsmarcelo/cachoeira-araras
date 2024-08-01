'use client'
import React from 'react'
import { VoucherTable } from './voucher-table'
import { columns } from "./columns"
import { api } from '@/trpc/react'
import { type VoucherSchema } from '@/lib/voucher/types'

export default function DataTable() {
  const { data: vouchers, isLoading, isError } = api.voucher.findAll.useQuery()

  if (isLoading) {
    return <div className="text-center">Carregando...</div>
  }

  if (isError) {
    return <div className="text-center">Erro ao carregar os dados</div>
  }

  return (
    <div>
      <VoucherTable columns={columns} data={vouchers as VoucherSchema[]} />
    </div>
  )
}
