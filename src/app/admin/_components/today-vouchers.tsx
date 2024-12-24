'use client'
import { api } from '@/trpc/react'
import { getBrazilianDate } from '@/lib/utils/date'
import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { VoucherInfoCard } from '../voucher-info-card'
import type { CompleteVoucherSchema } from '@/lib/voucher/types'
import { formatQuantity } from '@/lib/voucher'

function VoucherCard({ voucher, onClick }: {
  voucher: CompleteVoucherSchema,
  onClick: (voucher: CompleteVoucherSchema) => void
}) {
  return (
    <div
      key={voucher.id}
      className='py-2 px-2 hover:bg-slate-50 cursor-pointer rounded-md'
      onClick={() => onClick(voucher)}
    >
      <div className='flex justify-between items-center'>
        <div>
          <p className='font-medium'>{voucher.name}</p>
          <p className='text-base text-black'>{voucher.code}</p>
        </div>
        <div className='text-right'>
          <p className='font-medium'>{formatQuantity({ adults: voucher.adults, elderly: voucher.elderly })}</p>
        </div>
      </div>
    </div>
  )
}

export default function TodayVouchers() {
  const [selectedVoucher, setSelectedVoucher] = useState<CompleteVoucherSchema | null>(null)
  const today = getBrazilianDate()
  const { data: vouchers, isLoading } = api.voucher.getTodayVouchers.useQuery()

  if (isLoading) {
    return (
      <div className='w-full h-32 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin' />
      </div>
    )
  }

  if (!vouchers?.length) {
    return (
      <div className='text-center py-8'>
        <p className='text-lg text-slate-500'>Nenhum voucher para hoje</p>
      </div>
    )
  }

  const paidVouchers = vouchers.filter(v => v.status === 'paid')
  const pendingVouchers = vouchers.filter(v => v.status === 'pending')

  return (
    <>
      <div className='space-y-8'>
        <h2 className='text-xl font-semibold text-center'>
          Vouchers para {today.toLocaleDateString()}
        </h2>

        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Confirmados ({paidVouchers.length})</h3>
          <div className='divide-y'>
            {paidVouchers.map((voucher) => (
              <VoucherCard
                key={voucher.id}
                voucher={{ ...voucher, payment_id: voucher.payment_id ?? undefined }}
                onClick={(v) => setSelectedVoucher(v)}
              />
            ))}
          </div>
        </div>

        {pendingVouchers.length > 0 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-medium text-amber-600'>Pendentes ({pendingVouchers.length})</h3>
            <div className='divide-y'>
              {pendingVouchers.map((voucher) => (
                <VoucherCard
                  key={voucher.id}
                  voucher={{ ...voucher, payment_id: voucher.payment_id ?? undefined }}
                  onClick={(v) => setSelectedVoucher(v)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedVoucher && (
        <VoucherInfoCard
          data={selectedVoucher}
          open={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}
    </>
  )
}
