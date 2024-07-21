import React from 'react'
import { api } from "@/trpc/server";
import PaymentCard from '@/app/_components/payment-card';
import VoucherCard from '@/app/_components/voucher-card';
import { type PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { formatWhatsAppMessage } from '@/lib/utils';
import Link from 'next/link';
import { FaWhatsapp } from "react-icons/fa";
import { type PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import { confirmVoucherPayment } from '@/lib/voucher';
import DeleteVoucherCookieBtn from '@/app/_components/delete-voucher-cookie-btn';

const fetchPreference = async (preference_id: string): Promise<PreferenceResponse> => {
  try {
    const res = await api.mercadopago.getPreference({ preference_id });
    if (!res) throw new Error('Failed to fetch payment');
    return res;
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

const fetchPayment = async (payment_id: string): Promise<PaymentResponse> => {
  try {
    const res = await api.mercadopago.getPayment({ payment_id });
    if (!res) throw new Error('Failed to fetch payment');
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
    return <div>Link inválido</div>
  }

  const { preference_id, payment_id } = searchParams;

  const preference = await fetchPreference(preference_id as string)
  const paymentURL = preference.init_point

  const payment = await fetchPayment(payment_id as string)
  if (payment.status === 'denied') {
    return <div>Pagamento não aprovado</div>
  }
  if (payment.status === 'pending' && paymentURL) {
    return <div>
      Pagamento pendente, apos o pagamento, atualize a página
      <Button onClick={() => redirect(paymentURL)}>Clique aqui para finalizar o pagamento</Button>
    </div>
  }
  const voucher = await confirmVoucherPayment(preference_id as string, payment_id as string)
  if (!voucher) return <div>Voucher não encontrado</div>
  return (
    <div className="flex flex-col mt-12 px-4 items-center h-screen mb-96">
      <h1 className='text-center text-4xl font-bold text-green-500'>Pagamento aprovado</h1>
      <div className='mt-12 flex flex-col gap-8'>
        <PaymentCard data={preference} payment_id={payment_id as string} />
        <VoucherCard data={voucher} />
      </div>
      <Button className='mt-12 flex gap-4 bg-green-600 py-4 h-[contain]'>
        <FaWhatsapp className="h-8 w-8" />
        <Link href={formatWhatsAppMessage(voucher)} target='_blank' className='whitespace-pre-wrap'>Envie o voucher para o WhatsApp da Cachoeira das Araras</Link>
      </Button>
      <DeleteVoucherCookieBtn />
    </div>
  )
}
