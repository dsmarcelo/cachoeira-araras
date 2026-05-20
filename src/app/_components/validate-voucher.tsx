'use client'
import React, { type ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type RouterOutputs } from '@/trpc/react'
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { formatVoucherStatus } from '@/lib/voucher'
import { VoucherInfoCard } from '../admin/voucher-info-card'
import { type CompleteVoucherSchema } from '@/lib/voucher/types'

type TVoucher = RouterOutputs['voucher']['findByCode'];
export default function ValidateVoucher() {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucher, setVoucher] = useState<TVoucher>();
  const [valid, setValid] = useState(false);
  const [openMoreInfo, setOpenMoreInfo] = useState(false);
  const [message, setMessage] = useState('');

  const redeemVoucher = api.voucher.redeemByCode.useMutation()

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setVoucher(undefined);
    setValid(false);
    setMessage('');
    const { value } = e.target;
    return setVoucherCode(value.replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 4));
  }

  const { refetch, isLoading } = api.voucher.findByCode.useQuery({ code: voucherCode }, {
    enabled: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 2
  });

  const formSchema = z.object({
    code: z.string().trim(),
  });

  type FormSchema = z.infer<typeof formSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
    },
  });

  async function fetchVoucher() {
    if (voucher) {
      setValid(voucher.valid);
      return setMessage('Código de voucher válido, deseja usar o voucher?')
    }
  }

  async function useVoucher() {
    if (!voucherCode) return null
    try {
      const res = await redeemVoucher.mutateAsync({
        code: voucherCode,
      })
      setVoucher(undefined);
      setValid(false);
      setMessage('Voucher usado com sucesso')
      return res
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao usar voucher'
      setMessage(errorMessage)
      return null
    }
  }

  async function onSubmit() {
    if (!voucherCode) return null
    const res = await refetch();
    if (!res.data) {
      return setMessage('Voucher não encontrado')
    }
    setVoucher(res.data)
    if (res.data.valid) {
      setValid(res.data.valid);
      setMessage('Código de voucher válido, deseja usar o voucher?')
      return await fetchVoucher();
    }
    setValid(false);
  }

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
          <form onSubmit={handleSubmit(onSubmit)} className='grid gap-4'>
            <div className='grid gap-2'>
              <label htmlFor="code">Insira o código do voucher</label>
              <Input
                {...register('code')}
                className='text-center text-2xl font-medium h-14'
                onChange={handleChange}
                value={voucherCode}
                type="text"
                id="code"
                max={4}
                placeholder="Código do Voucher"
              />
            </div>
            <Button className='h-14' type="submit">
              {isLoading ? 'Validando...' : 'Validar'}
            </Button>
            {errors.code && <p className='text-red-500 text-sm w-full'>{errors.code?.message}</p>}
            {voucher && <div className='mx-auto'>{voucher && formatVoucherStatus(voucher.status)}</div>}
          </form>
        </CardContent>
      </Card>
      {message && <h3 className='text-black font-semibold text-center'>{message}</h3>}
      {voucher && <Button className='w-full mx-auto' variant={'outline'} onClick={() => setOpenMoreInfo(true)}>Ver Detalhes</Button>}
      {valid ?
        <Button type='button' onClick={useVoucher} className='bg-green-500 font-semibold text-center'>Usar Voucher</Button>
        : null}
      {voucher ?
        <div className='flex overflow-visible flex-col justify-center gap-4 w-full'>
          <VoucherInfoCard
            data={voucher as CompleteVoucherSchema}
            open={!!openMoreInfo}
            onClose={() => setOpenMoreInfo(false)}
          />
        </div>
        : null}
    </div>
  )
}
