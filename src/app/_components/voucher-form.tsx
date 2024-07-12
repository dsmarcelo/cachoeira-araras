'use client'

import { api } from "@/trpc/react";

import React from 'react'
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhone, formatVoucher, voucherFormSchema } from '@/lib/utils/utils'

export default function VoucherForm() {
  type FormSchema = z.infer<typeof voucherFormSchema>
  const addVoucher = api.voucher.create.useMutation();

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormSchema>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      peopleQty: 1,
    },
  });

  function normalizePhone(value: string) {
    return value.replace(/\D/g, '');
  };

  async function onSubmit(data: FormSchema) {
    const completeData = formatVoucher(data);

    try {
      const res = await addVoucher.mutateAsync(completeData);
      return res;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">Adquira já seu voucher</CardTitle>
        <CardDescription>
          Depois é só mostrar o codigo de identificação na portaria!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Nome"
              {...register('name',
                { required: "Nome é obrigatório" },
              )} />
            {errors.name && <p className='text-red-500 text-sm'>{errors.name?.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="phone"
                  type="tel"
                  placeholder="(XX) 99999-9999"
                  value={formatPhone(field.value)}
                  onChange={(e) => field.onChange(normalizePhone(e.target.value))}
                />
              )}
            />
            {errors.phone && <p className='text-red-500 text-sm'>{errors.phone?.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="peopleQty">Quantidade de pessoas <span className='text-gray-700 font-thin text-sm'>(acima de 11 anos)</span></Label>
            <Input
              id="peopleQty"
              type="number"
              min="1"
              max="10"
              {...register('peopleQty',
                { required: true, min: 1, max: 10 },
              )} />
            {errors.peopleQty && <p className='text-red-500 text-sm'>{errors.peopleQty?.message}</p>}
          </div>
          <div className="grid gap-2">
          </div>
          <Button disabled={isSubmitting} type="submit" className="w-full">
            {addVoucher.isPending ? 'Carregando...' : 'Compre seu voucher agora!'}
          </Button>
          {addVoucher.isSuccess && <p className='text-green-500 text-sm'>Voucher criado com sucesso!</p>}
          {addVoucher.isError && <p className='text-red-500 text-sm'>Erro ao criar o voucher!</p>}
        </form>
      </CardContent>
    </Card>
  )
}
