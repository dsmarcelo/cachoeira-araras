'use client'
import { useMutation, useQuery } from 'convex/react'
import React, { type ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatVoucherStatus } from '@/lib/voucher'
import { api } from '../../../convex/_generated/api'

/**
 * Gate staff type a Voucher Code, see its live status, and redeem it. Backed
 * directly by Convex: `getByCode` is a reactive query (so a payment the
 * Mercado Pago webhook just confirmed shows up without refetching) and
 * `redeemByCode` is staff-gated server-side, so a public caller can neither
 * read nor redeem anything even if this component were reachable by one.
 */
export default function ValidateVoucher() {
  const [voucherCode, setVoucherCode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [message, setMessage] = useState('');

  const voucher = useQuery(
    api.vouchers.getByCode,
    lookupCode ? { code: lookupCode } : "skip",
  );
  const redeemByCode = useMutation(api.vouchers.redeemByCode);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setLookupCode('');
    setMessage('');
    const { value } = e.target;
    setVoucherCode(value.replace(/[^a-z0-9]/gi, "").toLowerCase());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!voucherCode) return;
    setLookupCode(voucherCode);
    setMessage('');
  }

  async function handleRedeem() {
    if (!lookupCode) return;
    try {
      await redeemByCode({ code: lookupCode });
      setMessage('Voucher usado com sucesso');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao usar voucher');
    }
  }

  const isLoading = lookupCode !== '' && voucher === undefined;
  const notFound = lookupCode !== '' && voucher === null;

  function dynamicCardBorder() {
    switch (voucher?.status) {
      case 'redeemed':
        return 'border-red-500';
      case 'pending':
        return 'border-yellow-500';
      case 'valid':
        return 'border-green-500';
      case 'expired':
        return 'border-slate-500';
      default:
        return '';
    }
  }

  return (
    <div className='grid gap-4 mb-6 w-full'>
      <Card className={`${dynamicCardBorder()} w-full mx-auto`}>
        <CardHeader>
          <CardTitle>Validar Voucher</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <form onSubmit={handleSubmit} className='grid gap-4'>
            <div className='grid gap-2'>
              <label htmlFor="code">Insira o código do voucher</label>
              <Input
                className='text-center text-2xl font-medium h-14'
                onChange={handleChange}
                value={voucherCode}
                type="text"
                id="code"
                placeholder="Código do Voucher"
              />
            </div>
            <Button className='h-14' type="submit" disabled={!voucherCode}>
              {isLoading ? 'Validando...' : 'Validar'}
            </Button>
            {voucher && <div className='mx-auto'>{formatVoucherStatus(voucher.status)}</div>}
            {notFound && <p className='text-red-500 text-sm w-full text-center'>Voucher não encontrado</p>}
          </form>
        </CardContent>
      </Card>
      {message && <h3 className='text-black font-semibold text-center'>{message}</h3>}
      {voucher?.status === 'valid' ?
        <Button type='button' onClick={handleRedeem} className='bg-green-500 font-semibold text-center'>Usar Voucher</Button>
        : null}
    </div>
  )
}
