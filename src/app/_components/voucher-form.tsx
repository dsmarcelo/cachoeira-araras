'use client'
import { api } from "@/trpc/react";
import React, { useEffect, useState } from 'react'
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
import { calculatePrice, formatVoucher, randomCode } from '@/lib/utils/utils'
import { useRouter } from 'next/navigation';
import { voucherFormSchema } from "@/lib/voucher/types";
import { formatPaymentUrl, formatPhone } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast"
import { addCookieVoucher, deleteCookieVoucher, getCookieVoucher } from "../lib";
import VoucherCreatedCard from "./voucher-created-card";

export default function VoucherForm() {
  const router = useRouter();
  const { toast } = useToast()
  const [code, setCode] = useState('');
  const [init_point, setInitPoint] = useState('');
  const [payment_sucess_url, setPaymentSuccessUrl] = useState('');

  const utils = api.useUtils();

  useEffect(() => {
    async function getPreference() {
      const cookieVoucher = await getCookieVoucher();
      if (cookieVoucher) {
        const voucher = await utils.voucher.findByCode.fetch({ code: cookieVoucher });
        if (!voucher) return deleteCookieVoucher();
        setCode(cookieVoucher);

        if (voucher.status !== 'pending' && voucher.payment_id) {
          const url = formatPaymentUrl(voucher.preference_id, voucher.payment_id);
          setPaymentSuccessUrl(url);
        }

        const preference = await utils.mercadopago.getPrefence.fetch({ preference_id: voucher.preference_id });

        if (preference.init_point) {
          setInitPoint(preference.init_point);
        }
      }
      return null
    }
    void getPreference();
  }, [])

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

  async function buyVoucher({ data, code }: { data: FormSchema, code: string }) {
    const res = await mercadopago.mutateAsync({
      code,
      title: `Voucher ${code}`,
      id: code,
      description: `Voucher para ${data.adults} pessoas com mais de 8 anos e ${data.elderly} com mais de 60 anos ou especiais`,
      adults: data.adults,
      elderly: data.elderly,
      unit_price: calculatePrice(data.adults, data.elderly),
      name: data.name,
      surname: data.name,
      phone: data.phone,
    });

    if (!res) console.error('Failed to create preference');
    return res;
  }

  function redirectToPayment() {
    router.push(init_point);
  }

  async function onSubmit(data: FormSchema) {
    if (data.adults + data.elderly === 0) {
      console.log('Erro')
      return toast({
        title: 'Erro',
        description: 'Verifique a quantidade de pessoas',
      })
    }
    const rcode = randomCode();
    setCode(rcode);
    const res = await buyVoucher({ data, code: rcode });
    if (!res?.id || !res?.init_point) return;
    await addCookieVoucher(rcode);
    setInitPoint(res.init_point);
    const preference_id = res.id;
    const completeData = formatVoucher({ ...data, preference_id, code: rcode });
    try {
      const voucher = await addVoucher.mutateAsync(completeData);
      if (!voucher) return;
    } catch (error) {
      console.error(error);
    }
  };

  if (code) {
    return <VoucherCreatedCard code={code} init_point={init_point} redirectToPayment={redirectToPayment} setCode={setCode} payment_success_url={payment_sucess_url} />
  }

  return (
    <div className="mx-auto w-full bg-dark-blue">
      <div className="border-none bg-dark-blue text-primary-50 p-4 pb-0">
        <div className="">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Adquira já seu voucher</h2>
            <h5 className="text-primary-300">
              Depois é só mostrar o codigo de identificação na portaria!
            </h5>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 [&_input]:bg-primary-50 [&_input]:h-12">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                className="text-bg-blue"
                id="name"
                placeholder="Seu nome completo"
                maxLength={40}
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
                    className="text-bg-blue"
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
                className="text-bg-blue"
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
                className="text-bg-blue"
                {...register('elderly')}
              />
              {errors.adults && <p className='text-red-500 text-sm'>{errors.elderly?.message}</p>}
            </div>
            <div className="grid gap-2">
            </div>
            <h1 className=' font-bold'>{`Valor: R$${calculatePrice(formValues.adults, formValues.elderly).toFixed(2)}`}</h1>
            <Button disabled={isSubmitting} type="submit" className="w-full h-16 text-xl rounded-xl bg-positive-green hover:bg-light-blue">
              {addVoucher.isPending ? 'Carregando...' : 'Compre seu voucher agora!'}
            </Button>
          </form>
          <div className='mt-4 flex flex-col gap-4'>
            {addVoucher.isError && <p className='text-red-500 text-sm'>Erro ao criar o voucher, tente novamente!</p>}
          </div>
        </div>
      </div >
    </div>
  )
}
