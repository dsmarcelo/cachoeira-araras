import React from 'react'
import { api } from "@/trpc/server";
import PaymentCard from '@/app/_components/payment-card';
import { type PreferenceSchema } from '@/lib/utils/mercadopago/types';
import VoucherCard from '@/app/_components/voucher-card';
import { type Voucher } from '@prisma/client';
import { type Payment } from 'mercadopago';
import { type PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { getServerSession } from 'next-auth';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { formatWhatsAppMessage } from '@/lib/utils';
import Link from 'next/link';
import { FaWhatsapp } from "react-icons/fa";

const fetchPreference = async (preference_id: string): Promise<PreferenceSchema> => {
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

const updateStatus = async (preference_id: string): Promise<Voucher> => {
  console.log('🚀 ~ updateStatus ~ preference_id:', preference_id);
  try {
    const voucher = await api.voucher.updateByPreference_id({
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
    return <div>Link inválido</div>
  }

  const { preference_id, payment_id } = searchParams;

  const preference = await fetchPreference(preference_id as string)
  const payment = await fetchPayment(payment_id as string)
  if (payment.status === 'denied') {
    return <div>Pagamento não aprovado</div>
  }
  if (payment.status === 'pending') {
    return <div>
      Pagamento pendente, apos o pagamento, atualize a página
      <Button onClick={() => redirect(preference.init_point)}>Clique aqui para finalizar o pagamento</Button>
    </div>
  }
  const voucher = await updateStatus(preference_id as string)
  return (
    <div className="flex flex-col mt-12 px-4 items-center h-screen mb-96">
      <h1 className='text-center text-4xl font-bold text-green-500'>Pagamento aprovado</h1>
      <div className='mt-12 flex flex-col gap-8'>
        <PaymentCard data={preference} payment_id={payment_id as string} />
        <VoucherCard data={voucher} />
      </div>
      <Button className='mt-12 flex gap-4 bg-green-600 py-4 h-[contain]'>
        <FaWhatsapp className="h-8 w-8" />
        <Link href={formatWhatsAppMessage(voucher)} target='_blanck' className='whitespace-pre-wrap'>Envie o voucher para o WhatsApp da Cachoeira das Araras</Link>
      </Button>
    </div>
  )
}
