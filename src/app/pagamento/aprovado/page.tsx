import React from 'react'
import { api } from "@/trpc/server";
import PaymentCard from '@/app/_components/payment-card';
import { type PreferenceSchema } from '@/lib/utils/mercadopago/types';
import VoucherCard from '@/app/_components/voucher-card';
import { type Voucher } from '@prisma/client';

const fetchPayment = async (preference_id: string): Promise<PreferenceSchema> => {
  try {
    const res = await api.mercadopago.getPayment({ preference_id });
    if (!res) throw new Error('Failed to fetch payment');
    return res;
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

const updateStatus = async (preference_id: string): Promise<Voucher> => {
  console.log('🚀 ~ updateStatus ~ preference_id:', preference_id);
  try {
    const voucher = await api.voucher.updateVoucher({
      preference_id,
      status: "valid" as const,
      valid: true
    })

    if (!voucher) throw new Error('Failed to update voucher');
    return voucher;
  } catch (error) {
    console.error('Error updating voucher:', error);
    throw error;
  }
};

export default async function PaymentApprovedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const allStrings = Object.values(searchParams).every(value => typeof value === 'string');

  if (!allStrings) {
    return <div>Missing required fields</div>
  }

  const { preference_id, status, payment_id } = searchParams;

  const payment = await fetchPayment(preference_id as string)
  if (status !== 'approved') {
    return <div>Pagamento não aprovado</div>
  }
  const voucher = await updateStatus(preference_id as string)
  return (
    <div className="flex flex-col mt-12 items-center h-screen">
      <h1 className='text-center text-4xl font-bold text-green-500'>Pagamento aprovado</h1>
      <div className='mt-12' >
        <PaymentCard data={payment} payment_id={payment_id as string} />
        <VoucherCard data={voucher} />
      </div>
    </div>
  )
}
