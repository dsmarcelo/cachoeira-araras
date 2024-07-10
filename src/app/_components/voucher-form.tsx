'use client'

import React from 'react'
import { z } from "zod"
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
import { formatPhone } from '@/lib/utils/utils'

export default function VoucherForm() {
  const formSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatorio').max(100, 'Nome deve ser menor que 100 caracteres'),
    phone: z.string().trim(),
    peopleQty: z.coerce.number().gte(1, 'Quantidade inválida').lte(10, 'No maximo 10 pessoas').int(),
  }).refine(
    (data) => {
      return data.phone.length >= 11 &&
        data.phone.charAt(2) === '9';
    },
    {
      message: 'Número incorreto, não se esqueça de colocar o DDD e o 9 no início',
      path: ['phone'],
    })

  type FormSchema = z.infer<typeof formSchema>

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      phone: '',
      peopleQty: 1,
    },
  });

  function normalizePhone(value: string) {
    return value.replace(/\D/g, '');
  };

  const onSubmit = (data: FormSchema) => {
    console.log(data);
  };

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Voucher</CardTitle>
        <CardDescription>
          Adquira já seu voucher
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Telefone</Label>
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
            <Label htmlFor="peopleQty">Quantidade de pessoas</Label>
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
          <Button type="submit" className="w-full">
            Compre seu voucher agora!
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
