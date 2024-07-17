'use client'
import React, { type ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type RouterOutputs } from '@/trpc/react'
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import VoucherCard from './voucher-card'

type TVoucher = RouterOutputs['voucher']['findByCode'];
export default function ValidateVoucher() {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucher, setVoucher] = useState<TVoucher>();
  const [valid, setValid] = useState(false);
  const [message, setMessage] = useState('');

  const updateVoucher = api.voucher.updateVoucherStatus.useMutation()

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
    const res = await updateVoucher.mutateAsync({
      code: voucherCode,
      data: {
        status: "redeemed",
        valid: false,
      }
    })
    return res
  }

  async function onSubmit() {
    if (!voucherCode) return null
    const res = await refetch();
    if (!res.data) {
      return setMessage('Voucher não encontrado')
    }
    if (res.data.valid) {
      setVoucher(res.data)
      setValid(res.data.valid);
      setMessage('Código de voucher válido, deseja usar o voucher?')
      return await fetchVoucher();
    }
    setValid(false);
    return setMessage('Código de voucher inválido')
  }

  return (
    <div className='grid gap-4 mb-6 w-full'>
      <Card className={`${valid && 'border-green-500'} w-full mx-auto max-w-md`}>
        < CardHeader >
          <CardTitle>Validar Voucher</CardTitle>
        </ CardHeader>
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
            {errors.code && <p className='text-red-500 text-sm'>{errors.code?.message}</p>}
            <h3 className='text-black font-semibold text-center'>{message}</h3>
            {valid ?
              <Button type='button' onClick={useVoucher} className='bg-green-500 font-semibold text-center'>Usar Voucher</Button>
              : null}
          </form>
        </CardContent>
      </Card>
      {voucher ?
        <VoucherCard data={voucher} />
        : null}
    </div>
  )
}
