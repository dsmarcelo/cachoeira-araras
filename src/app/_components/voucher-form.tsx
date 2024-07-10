'use client'

import React from 'react'
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormProvider, useForm } from "react-hook-form"
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
import Link from 'next/link'

export default function VoucherForm() {
  const formSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatorio').max(100, 'Nome deve ser menor que 100 caracteres'),
    phone: z.string().trim(),
    peopleQty: z.coerce.number().gte(1, 'Quantidade inválida').lte(10, 'No maximo 10 pessoas').int().positive(),
  }).refine(
    (data) => {
      return data.phone.length === 11 &&
        data.phone.charAt(2) === '9';
    },
    {
      message: 'Número incorreto.',
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

  function formatPhone(input: string): string {
    console.log('🚀 ~ formatPhone ~ input:', input);
    const cleanNumber = input.replace(/\D/g, '');

    // Formatação: (XX) 9 XXXX-XXXX
    if (cleanNumber.length === 11) {
      const ddd = cleanNumber.substring(0, 2);
      const parte1 = cleanNumber.substring(2, 3);
      const parte2 = cleanNumber.substring(3, 7);
      const parte3 = cleanNumber.substring(7);

      return `(${ddd}) ${parte1} ${parte2}-${parte3}`;
    }
    return input;
  }

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
            <Input
              id="phone"
              type="tel"
              placeholder="(XX) 99999-9999"
              {...register('phone')}
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
