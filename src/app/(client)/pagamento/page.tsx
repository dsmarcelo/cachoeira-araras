import React from 'react'
import { api } from "@/trpc/server";
import PaymentCard from '@/app/_components/payment-card';
import VoucherCard from '@/app/_components/voucher-card';
import { type PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { type PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import { confirmVoucherPayment } from '@/lib/voucher/server-utils';
import DeleteVoucherCookieBtn from '@/app/_components/delete-voucher-cookie-btn';
import PendingPaymentCard from './pendingPayment';

const fetchPreference = async (preference_id: string): Promise<PreferenceResponse | null> => {
  try {
    const res = await api.mercadopago.getPreference({ preference_id });
    if (!res) return null
    return res;
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

const fetchPayment = async (payment_id: string): Promise<PaymentResponse | null> => {
  try {
    const res = await api.mercadopago.getPayment({ payment_id });
    if (!res) return null
    return res;
  } catch (error) {
    console.error('Error fetching payment:', error);
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
    return <div className='text-center h-screen text-3xl'>Link inválido</div>
  }

  const { preference_id, payment_id } = searchParams;
  if (!preference_id || !payment_id) return <div className='text-center h-screen text-3xl'>Link inválido</div>

  const preference = await fetchPreference(preference_id as string)
  if (!preference) return <div className='text-center h-screen text-3xl'>Erro ao buscar preferência</div>
  const paymentURL = preference.init_point

  const payment = await fetchPayment(payment_id as string)

  if (!payment) return <div className='text-center h-screen text-3xl'>Erro ao buscar pagamento</div>

  if (payment.status === 'denied') {
    return <div>Pagamento não aprovado</div>
  }
  if (payment.status === 'pending' && paymentURL) {
    return <PendingPaymentCard paymentURL={paymentURL} />
  }
  if (payment.status === 'approved') {
    const voucher = await confirmVoucherPayment(preference_id as string, payment_id as string)
    if (!voucher) return <div className='text-center h-screen text-3xl'>Não foi possível confirmar o pagamento</div>

    return (
      <div className="flex flex-col w-full pt-8 px-4 items-center pb-24 bg-bg-blue overflow-hidden">
        <h1 className='text-center text-2xl font-bold text-green-500 mb-8'>Pagamento aprovado</h1>
        <div className='w-full max-w-lg flex flex-col gap-8'>
          <PaymentCard data={preference} payment_id={payment_id as string} />
          <VoucherCard data={voucher} />
          <DeleteVoucherCookieBtn />
        </div>
      </div>
    )
  }
}
