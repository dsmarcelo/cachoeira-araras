"use client";
import { useAction, useQuery } from "convex/react";
import { api as convexApi } from "../../../convex/_generated/api";
import React, { useEffect, useState } from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { voucherFormSchema } from "@/lib/voucher/types";
import { cn, formatPhone } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  addCookieVoucher,
  deleteCookieVoucher,
  getCookieVoucher,
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
import { getBrazilianDate } from "@/lib/utils/date";
import NumberInput from "./input/number-input";

export default function VoucherForm({
  testMode = false,
}: {
  testMode?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [init_point, setInitPoint] = useState("");
  const [referrerURL, setReferrerURL] = useState<string | null>(null);

  // A live Convex query: a settings change made in the admin page reaches
  // this open form without a reload.
  const settings = useQuery(convexApi.settings.getAll);
  const startCheckout = useAction(convexApi.vouchers.startCheckout);

  // Reactive payment status: the moment the Mercado Pago webhook confirms
  // this voucher (convex/vouchers.ts confirmPayment), this subscription
  // updates on its own — no polling, no reload.
  const voucherStatus = useQuery(
    convexApi.vouchers.getByCode,
    code ? { code } : "skip",
  );
  const payment_sucess_url =
    voucherStatus && voucherStatus.status !== "pending"
      ? `/pagamento?external_reference=${code}`
      : "";

  // Destructure settings with defaults; prices are stored in cents and
  // converted to reais here, the one boundary where that conversion happens
  // on the way into the UI.
  const {
    "disabled.days": disabledDays = [],
    "max.intended.days": maxIntendedDays = 60,
    "form.message": formMessage = "",
    "voucher.price": voucherPriceCents = 5000,
    "voucher.max.quantity.adults": maxAdults = 20,
    "enable.voucher.buy": enableVoucherBuy = true,
  } = settings ?? {};
  const voucherPrice = voucherPriceCents / 100;

  useEffect(() => {
    // Avoid an extra Edge request by reading the referrer on the client directly
    try {
      setReferrerURL(document.referrer || null);
    } catch {
      setReferrerURL(null);
    }

    async function restoreCookieVoucher() {
      const cookieVoucher = await getCookieVoucher();
      if (!cookieVoucher) return;
      setCode(cookieVoucher.code);
      setInitPoint(cookieVoucher.initPoint);
    }

    void restoreCookieVoucher();
    // Runs once on mount: the reactive Convex query above takes over from
    // here for anything that used to require re-fetching on visibility change.
  }, []);

  useEffect(() => {
    // A voucher whose code no longer resolves (soft-deleted, or the cookie
    // is stale) shouldn't keep a dead code around client-side.
    if (code && voucherStatus === null) {
      void deleteCookieVoucher();
      setCode("");
      setInitPoint("");
    }
  }, [code, voucherStatus]);

  type FormSchema = z.infer<typeof voucherFormSchema>;
  const [checkoutFailed, setCheckoutFailed] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormSchema>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      name: testMode ? "--TESTE--" : "",
      phone: "",
      adults: 0,
      elderly: 0,
      adults_pool: 0,
      elderly_pool: 0,
    },
  });

  const formValues = useWatch({ control });
  const totalPrice = testMode
    ? 0.01
    : (formValues.adults ?? 0) * voucherPrice;

  function normalizePhone(value: string) {
    return value.replace(/\D/g, "");
  }

  function redirectToPayment() {
    router.push(init_point);
  }

  async function onSubmit(data: FormSchema) {
    // Guard against disabled feature flags
    if (!enableVoucherBuy && (data.adults > 0 || data.elderly > 0)) {
      return toast({
        title: "Indisponível",
        description: "Compra de voucher normal está desativada",
      });
    }
    if (data.adults === 0) {
      return toast({
        title: "Erro",
        description: "Verifique a quantidade de pessoas",
      });
    }
    try {
      setIsLoading(true);
      setCheckoutFailed(false);
      const checkout = await startCheckout({
        name: data.name,
        phone: data.phone,
        adults: data.adults,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
        visitDateMs: data.intendedDate.getTime(),
        testMode,
        referrerUrl: referrerURL,
      });
      setCode(checkout.code);
      await addCookieVoucher(checkout.code, checkout.initPoint);
      setInitPoint(checkout.initPoint);
      setIsLoading(false);
    } catch (error) {
      setCheckoutFailed(true);
      console.error(error);
      setIsLoading(false);
      return toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Erro ao criar voucher. Tente novamente.",
      });
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

  // The public form now exposes only the standard voucher purchase option.
  if (!enableVoucherBuy) {
    return (
      <div className="mx-auto w-full bg-dark-blue">
        <div className="border-none bg-dark-blue p-4 text-primary-50">
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <p className="text-center text-lg font-bold text-orange-100">
              Compra de voucher temporariamente indisponível pelo site
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full bg-dark-blue">
      <div className="border-none bg-dark-blue p-4 text-primary-50">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 [&_input]:h-12 [&_input]:bg-primary-50 [&_label]:text-base [&_label]:leading-none"
        >
          {formMessage && (
            <div className="flex flex-col gap-2 rounded-xl bg-orange-600 p-2">
              <h3 className="text-center text-sm font-bold uppercase text-white">
                {formMessage}
              </h3>
            </div>
          )}
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
                  maxLength={15}
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

          <div className="pt-4">
            <p className="text-center text-sm font-bold text-primary-100">
              Selecione a quantidade de pessoas
            </p>

            <div className="flex flex-col divide-y divide-primary-100">
              {enableVoucherBuy && (
                <>
                  <div className="flex items-center justify-between gap-2 py-4">
                    <Label className="">
                      <p className="text-base font-bold">Voucher</p>
                      <p className="text-sm">Day Use</p>
                      <p className="text-sm">
                        R$ {voucherPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </Label>
                    <div className="w-fit">
                      <Controller
                        name="adults"
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            id="adults"
                            minValue={0}
                            maxValue={maxAdults}
                            selectedValue={field.value}
                            onChange={field.onChange}
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

                </>
              )}
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
                          maxDate.setDate(today.getDate() + maxIntendedDays);

                          // Check if date is in the past or beyond max date
                          if (date < yesterday || date > maxDate) {
                            return true;
                          }

                          // Check if date is in the disabled days list
                          const dateStr = date.toISOString().slice(0, 10); // Format as YYYY-MM-DD
                          return disabledDays.includes(dateStr);
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

          <h1 className="font-bold">{`Valor: R$${totalPrice.toFixed(2).replace(".", ",")}`}</h1>

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
        {checkoutFailed && (
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
