import React from 'react'
import PaymentCard from '@/app/_components/payment-card';
import VoucherCard from '@/app/_components/voucher-card';
import { type PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { type PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import DeleteVoucherCookieBtn from '@/app/_components/delete-voucher-cookie-btn';
import {
  getMercadoPagoPayment,
  getMercadoPagoPreference,
} from "@/server/mercadopago";
import { findVoucherByCode } from "@/server/voucher";

const fetchPreference = async (preference_id: string): Promise<PreferenceResponse | null> => {
  try {
    return await getMercadoPagoPreference(preference_id);
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

const fetchPayment = async (payment_id: string): Promise<PaymentResponse | null> => {
  try {
    return await getMercadoPagoPayment(payment_id);
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

export default async function voucherPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const allStrings = Object.values(searchParams).every(value => typeof value === 'string');

  if (!allStrings) {
    return <div className='text-center h-screen text-3xl'>Link inválido</div>
  }

  const { code, pid } = searchParams;
  if (!code || !pid) return <div className='text-center h-screen text-3xl'>Link inválido</div>

  const payment = await fetchPayment(pid as string)
  if (!payment) return <div className='text-center h-screen text-3xl'>Erro ao buscar pagamento</div>

  if (payment.status === 'denied') {
    return <div>Pagamento não aprovado</div>
  }

  const voucher = await findVoucherByCode(code as string);

  if (!voucher) return <div className='text-center h-screen text-3xl'>Não foi possível encontrar o voucher</div>

  const preference = await fetchPreference(voucher.preference_id);

  return (
    <div className="flex flex-col w-full pt-8 px-4 items-center pb-24 bg-bg-blue overflow-hidden">
      <h1 className='text-center text-2xl font-bold text-primary-100 mb-8'>Obrigado por comprar seu voucher na Cachoeira das Araras!</h1>
      <div className='w-full max-w-lg flex flex-col items-center gap-8'>
        {preference && <PaymentCard data={preference} payment_id={pid as string} />}
        <VoucherCard data={voucher} />
        <DeleteVoucherCookieBtn />
      </div>
    </div>
  )
}
