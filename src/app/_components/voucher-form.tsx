"use client";
import { api } from "@/trpc/react";
import React, { useEffect, useState } from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePrice, formatVoucher, getElderlyVoucherPrice, getPoolElderlyVoucherPrice, getPoolVoucherPrice, getVoucherPrice, randomCode } from "@/lib/utils/utils";
import { useRouter } from "next/navigation";
import { voucherFormSchema } from "@/lib/voucher/types";
import { cn, formatPaymentUrl, formatPhone } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  addCookieVoucher,
  deleteCookieVoucher,
  getCookieVoucher,
  createReferrer,
} from "../lib";
import VoucherCreatedCard from "./voucher-created-card";
import { CalendarIcon, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatMercadoPagoDescription } from "@/lib/voucher";
import { getBrazilianDate } from "@/lib/utils/date";
import { env } from "@/env";
import NumberInput from "./input/number-input";

export default function VoucherForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [init_point, setInitPoint] = useState("");
  const [payment_sucess_url, setPaymentSuccessUrl] = useState("");
  const [referrerURL, setReferrerURL] = useState<string | null>(null);

  const utils = api.useUtils();

  async function checkPaymentStatus(code: string) {
    const voucher = await utils.voucher.findByCode.fetch({ code });
    if (!voucher) return deleteCookieVoucher();

    if (voucher.status !== "pending" && voucher.payment_id) {
      const url = formatPaymentUrl(voucher.preference_id, voucher.payment_id);
      setPaymentSuccessUrl(url);
    }

    const preference = await utils.mercadopago.getPrefence.fetch({
      preference_id: voucher.preference_id,
    });

    if (preference.init_point) {
      setInitPoint(preference.init_point);
    }
  }

  useEffect(() => {
    const checkReferrer = async () => {
      try {
        const response = await fetch("/api/check-referrer");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        setReferrerURL(data);
      } catch (error) {
        console.error("Error checking referrer:", error);
      }
    };

    async function getPreference() {
      if (code) {
        return await checkPaymentStatus(code);
      }
      const cookieVoucher = await getCookieVoucher();
      setCode(cookieVoucher ?? "");
      if (cookieVoucher) {
        await checkPaymentStatus(cookieVoucher);
      }
    }

    void checkReferrer();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void getPreference();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup the event listener on component unmount
    void getPreference();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utils.mercadopago.getPrefence, utils.voucher.findByCode]);

  type FormSchema = z.infer<typeof voucherFormSchema>;
  const addVoucher = api.voucher.create.useMutation();
  const mercadopago = api.mercadopago.create.useMutation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormSchema>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      adults: 1,
      elderly: 0,
      adults_pool: 0,
      elderly_pool: 0,
    },
  });

  const formValues = watch();

  function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
  }

  async function buyVoucher({
    data,
    code,
  }: {
    data: FormSchema;
    code: string;
  }) {
    const res = await mercadopago.mutateAsync({
      code,
      title: `Voucher ${code}`,
      id: code,
      description: formatMercadoPagoDescription({ adults: data.adults, elderly: data.elderly, adults_pool: data.adults_pool, elderly_pool: data.elderly_pool, phone: data.phone, code }),
      adults: data.adults,
      elderly: data.elderly,
      unit_price: calculatePrice(data.adults, data.elderly, data.adults_pool, data.elderly_pool),
      name: data.name.trim().split(" ")[0] ?? "",
      surname: data.name.trim().split(" ").slice(1).join(" ") ?? "",
      phone: data.phone,
    });

    if (!res) console.error("Failed to create preference");
    return res;
  }

  function redirectToPayment() {
    router.push(init_point);
  }

  async function onSubmit(data: FormSchema) {
    if (data.adults + data.elderly + data.adults_pool + data.elderly_pool === 0) {
      return toast({
        title: "Erro",
        description: "Verifique a quantidade de pessoas",
      });
    }
    try {
      setIsLoading(true);
      const rcode = randomCode();
      setCode(rcode);
      const res = await buyVoucher({ data, code: rcode });
      if (!res?.id || !res?.init_point)
        throw new Error("Falha ao criar preferencia");
      await addCookieVoucher(rcode);
      const preference_id = res.id;
      const completeData = formatVoucher({
        ...data,
        preference_id,
        code: rcode,
      });
      const voucher = await addVoucher.mutateAsync(completeData);
      if (!voucher)
        return toast({
          title: "Erro",
          description:
            "Erro ao criar o voucher, por favor atualize a página e tente novamente",
        });
      setInitPoint(res.init_point);
      if (referrerURL) {
        await createReferrer(rcode, referrerURL);
      }
      setIsLoading(false);
    } catch (error) {
      return console.error(error);
      // TODO: send error to server and show error page
    }
  }

  if (code && (init_point || payment_sucess_url)) {
    return (
      <VoucherCreatedCard
        code={code}
        init_point={init_point}
        redirectToPayment={redirectToPayment}
        setCode={setCode}
        payment_success_url={payment_sucess_url}
      />
    );
  }

  return (
    <div className="mx-auto w-full bg-dark-blue">
      <div className="border-none bg-dark-blue p-4 text-primary-50">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 [&_input]:h-12 [&_input]:bg-primary-50 [&_label]:text-base [&_label]:leading-none"
        >
          <h3 className="text-center text-sm font-medium uppercase leading-none text-primary-100">
            Entrada permitida entre 08h e 17h
          </h3>
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              className="rounded-xl text-bg-blue"
              id="name"
              placeholder="Seu nome completo"
              maxLength={40}
              {...register("name", { required: "Nome é obrigatório" })}
            />
            {errors.name && (
              <p className="text-base font-medium text-red-400">
                {errors.name?.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  className="rounded-xl text-bg-blue"
                  id="phone"
                  type="tel"
                  placeholder="(XX) 99999-9999"
                  value={formatPhone(field.value)}
                  onChange={(e) =>
                    field.onChange(normalizePhone(e.target.value))
                  }
                />
              )}
            />
            {errors.phone && (
              <p className="text-base font-medium text-red-400">
                {errors.phone?.message}
              </p>
            )}
          </div>

          <div className=" pt-4">
            <p className="text-sm text-primary-100 text-center font-bold">Selecione a quantidade de pessoas</p>

            <div className="flex flex-col divide-y divide-primary-100">
                <div className="flex items-center justify-between gap-2 py-4">
                  <Label className="">
                    <p className="font-bold text-base">Inteira</p>
                    <p className="text-sm">(de 9 a 59 anos)</p>
                    <p className="text-sm">R$ {getVoucherPrice().toFixed(2).replace('.', ',')}</p>
                  </Label>
                  <div className="w-fit">
                    <Controller
                      name="adults"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          id="adults"
                          minValue={0}
                          maxValue={20}
                          defaultValue={1}
                          selectedValue={field.value}
                          onChange={field.onChange}
                          className="rounded-xl text-bg-blue"
                          placeholder="Quantidade de adultos"
                        />
                      )}
                    />
                  </div>
                  {errors.adults && (
                    <p className="text-base font-medium text-red-400">
                      {errors.adults?.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 py-4">
                  <Label className="flex flex-col">
                    <p className="font-bold text-base">Meia</p>
                    <p className="text-sm">(+60 anos e especiais)</p>
                    <p className="text-sm">R$ {getElderlyVoucherPrice().toFixed(2).replace('.', ',')}</p>
                  </Label>
                  <div className="w-fit">
                    <Controller
                      name="elderly"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          id="elderly"
                          minValue={0}
                          maxValue={20}
                          defaultValue={0}
                          selectedValue={field.value}
                          onChange={field.onChange}
                          className="rounded-xl text-bg-blue"
                          placeholder="Quantidade de idosos"
                        />
                      )}
                    />
                  </div>
                  {errors.elderly && (
                    <p className="text-base font-medium text-red-400">
                      {errors.elderly?.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 py-4">
                  <Label className="flex flex-col">
                    <p className="font-bold text-base">Inteira (Piscina)</p>
                    <p className="text-sm">(de 9 a 59 anos)</p>
                    <p className="text-sm">R$ {getPoolVoucherPrice().toFixed(2).replace('.', ',')}</p>
                  </Label>
                  <div className="w-fit">
                    <Controller
                      name="adults_pool"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          id="adults_pool"
                          minValue={0}
                          maxValue={20}
                          defaultValue={0}
                          selectedValue={field.value}
                          onChange={field.onChange}
                          className="rounded-xl text-bg-blue"
                          placeholder="Quantidade de adultos"
                        />
                      )}
                    />
                  </div>
                  {errors.adults_pool && (
                    <p className="text-base font-medium text-red-400">
                      {errors.adults_pool?.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 py-4">
                  <Label className="flex flex-col">
                    <p className="font-bold text-base">Meia (Piscina)</p>
                    <p className="text-sm">(+60 anos e especiais)</p>
                    <p className="text-sm">R$ {getPoolElderlyVoucherPrice().toFixed(2).replace('.', ',')}</p>
                  </Label>
                  <div className="w-fit">
                    <Controller
                      name="elderly_pool"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          id="elderly_pool"
                          minValue={0}
                          maxValue={20}
                          defaultValue={0}
                          selectedValue={field.value}
                          onChange={field.onChange}
                          className="rounded-xl text-bg-blue"
                          placeholder="Quantidade de meias"
                        />
                      )}
                    />
                  </div>
                  {errors.elderly_pool && (
                    <p className="text-base font-medium text-red-400">
                      {errors.elderly_pool?.message}
                    </p>
                  )}
                </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary-50" />
              Selecione a data que pretende ir
            </Label>
            <Popover>
              <Controller
                name="intendedDate"
                control={control}
                render={({ field }) => (
                  <div>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "h-12 w-full justify-start rounded-xl bg-primary-50 text-left font-normal text-dark",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: ptBR })
                        ) : (
                          <span className="text-dark">Selecione uma data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 text-dark opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto rounded-2xl p-0 shadow-lg"
                      align="center"
                    >
                      <Calendar
                        className=""
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const today = getBrazilianDate();
                          const yesterday = getBrazilianDate(new Date(today));
                          yesterday.setDate(today.getDate() - 1);

                          const maxDate = getBrazilianDate(new Date(today));
                          maxDate.setDate(
                            today.getDate() + env.NEXT_PUBLIC_MAX_INTENDED_DAYS, //TODO: Replace with database config later
                          );

                          return date < yesterday || date > maxDate;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </div>
                )}
              />
            </Popover>
            {errors.intendedDate && (
              <p className="text-base font-medium text-red-400">
                {errors.intendedDate?.message}
              </p>
            )}
          </div>

          <h1 className="font-bold">{`Valor: R$${calculatePrice(formValues.adults, formValues.elderly, formValues.adults_pool, formValues.elderly_pool).toFixed(2).replace('.', ',')}`}</h1>

          <Button
            disabled={isSubmitting}
            type="submit"
            className="h-16 w-full rounded-xl bg-positive-green px-6 text-xl hover:bg-positive-green/80"
          >
            {isLoading ? (
              <div className="flex flex-row items-center justify-center">
                <Loader2 className="mr-2 animate-spin" />
                <p>Carregando...</p>
              </div>
            ) : (
              <div className="flex w-full flex-row items-center justify-between">
                <p>Continuar</p>
                <ChevronRight className="h-6 w-6" />
              </div>
            )}
          </Button>
        </form>
        {addVoucher.isError && (
          <div className="my-4 flex flex-col justify-center space-y-2 text-lg font-medium text-red-500">
            <p>Erro ao criar o voucher, tente novamente!</p>
            <Button onClick={() => location.reload()} className="h-20">
              Recarregar página
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
