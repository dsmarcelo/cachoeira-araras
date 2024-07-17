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
import { calculatePrice, formatVoucher, formatPhone } from '@/lib/utils/utils'
import { useRouter } from 'next/navigation';
import { voucherFormSchema } from "@/lib/voucher/types";

export default function VoucherForm() {
  const router = useRouter();

  type FormSchema = z.infer<typeof voucherFormSchema>
  const addVoucher = api.voucher.create.useMutation();
  const mercadopago = api.mercadopago.create.useMutation();

  const { register, handleSubmit, control, formState: { errors, isSubmitting }, watch } = useForm<FormSchema>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      adults: 1,
      elderly: 0,
    },
  });

  const formValues = watch();

  function normalizePhone(value: string) {
    return value.replace(/\D/g, '');
  };

  async function buyVoucher(data: FormSchema) {
    const res = await mercadopago.mutateAsync({
      title: 'Voucher para Cachoeira das Araras',
      description: `Voucher para ${data.adults} pessoas com mais de 8 anos e ${data.elderly} com mais de 60 anos ou especiais`,
      adults: data.adults,
      elderly: data.elderly,
      // unit_price: calculatePrice(data.adults, data.elderly),
      unit_price: 1,
      name: data.name,
      surname: data.name,
      phone: data.phone,
    });

    if (!res) console.error('Failed to create preference');
    return res;
  }

  async function onSubmit(data: FormSchema) {
    const res = await buyVoucher(data);
    if (!res?.id || !res?.init_point) return;
    const preference_id = res.id;
    const completeData = formatVoucher({ ...data, preference_id });
    try {
      const voucher = await addVoucher.mutateAsync(completeData);
      if (!voucher) return;
      router.push(res.init_point);
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
            <Label htmlFor="adults">Quantidade de pessoas <span className='font-bold'>com mais de 8 anos</span></Label>
            <Input
              id="adults"
              type="number"
              min="0"
              max="20"
              {...register('adults')}
            />
            {errors.adults && <p className='text-red-500 text-sm'>{errors.adults?.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="elderly">Mais de 60 anos ou especiais</Label>
            <Input
              id="elderly"
              type="number"
              min="0"
              max="20"
              {...register('elderly')}
            />
            {errors.adults && <p className='text-red-500 text-sm'>{errors.elderly?.message}</p>}
          </div>
          <div className="grid gap-2">
          </div>
          <h1>{`Valor: R$${calculatePrice(formValues.adults, formValues.elderly).toFixed(2)}`}</h1>
          <Button disabled={isSubmitting} type="submit" className="w-full">
            {addVoucher.isPending ? 'Carregando...' : 'Compre seu voucher agora!'}
          </Button>
          {addVoucher.isSuccess && <p className='text-green-500 text-sm'>Voucher criado com sucesso, redirecionando para o pagamento!</p>}
          {addVoucher.isError && <p className='text-red-500 text-sm'>Erro ao criar o voucher, tente novamente!</p>}
        </form>
      </CardContent>
    </Card >
  )
}
