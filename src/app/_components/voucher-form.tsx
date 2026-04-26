"use client";
import { api } from "@/trpc/react";
import React, { useEffect, useState } from "react";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatVoucher,
  randomCode,
} from "@/lib/utils/utils";
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
import NumberInput from "./input/number-input";
import { type Voucher } from "@/types/voucher";

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
  const [payment_sucess_url, setPaymentSuccessUrl] = useState("");
  const [referrerURL, setReferrerURL] = useState<string | null>(null);

  const utils = api.useUtils();

  // Get all settings from database using a single query
  const settingsQuery = api.settings.getAll.useQuery();

  // Destructure settings with defaults
  const {
    "disabled.days": disabledDays = [],
    "max.intended.days": maxIntendedDays = 60,
    "form.message": formMessage = "",
    "voucher.price": voucherPrice = 50,
    "voucher.pool.price": poolVoucherPrice = 70,
    "voucher.max.quantity.adults": maxAdults = 20,
    "voucher.max.quantity.elderly": maxElderly = 20,
    "voucher.max.quantity.adults.pool": maxAdultsPool = 20,
    "voucher.max.quantity.elderly.pool": maxElderlyPool = 20,
    "enable.voucher.buy": enableVoucherBuy = true,
    "enable.voucher.pool.buy": enablePoolVoucherBuy = true,
    "enable.voucher.half-price.buy": enableHalfPriceVoucherBuy = true,
    "enable.voucher.half-price.pool.buy": enableHalfPricePoolVoucherBuy = false,
  } = settingsQuery.data ?? {};
  const elderlyVoucherPrice = voucherPrice / 2;
  const poolElderlyVoucherPrice = poolVoucherPrice / 2;

  async function checkPaymentStatus(code: string) {
    const voucher = (await utils.voucher.getPublicStatusByCode.fetch({
      code,
    })) as Voucher;
    if (!voucher) return deleteCookieVoucher();

    if (voucher.status !== "pending" && voucher.payment_id) {
      const url = formatPaymentUrl(voucher.preference_id, voucher.payment_id);
      setPaymentSuccessUrl(url);
    }

    const preference = await utils.mercadopago.getPublicPreference.fetch({
      preference_id: voucher.preference_id,
    });

    if (preference.init_point) {
      setInitPoint(preference.init_point);
    }
  }

  useEffect(() => {
    // Avoid an extra Edge request by reading the referrer on the client directly
    const checkReferrer = async () => {
      try {
        const ref = document.referrer || null;
        setReferrerURL(ref);
      } catch {
        setReferrerURL(null);
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
  }, [settingsQuery]);

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
      name: testMode ? "--TESTE--" : "",
      phone: "",
      adults: 0,
      elderly: 0,
      adults_pool: 0,
      elderly_pool: 0,
    },
  });

  const formValues = watch();
  const totalPrice = testMode
    ? 0.01
    : formValues.adults * voucherPrice +
      formValues.elderly * elderlyVoucherPrice +
      formValues.adults_pool * poolVoucherPrice +
      formValues.elderly_pool * poolElderlyVoucherPrice;

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
      description: formatMercadoPagoDescription({
        adults: data.adults,
        elderly: data.elderly,
        adults_pool: data.adults_pool,
        elderly_pool: data.elderly_pool,
        phone: data.phone,
        code,
      }),
      adults: data.adults,
      elderly: data.elderly,
      adults_pool: data.adults_pool,
      elderly_pool: data.elderly_pool,
      intendedDate: data.intendedDate,
      testMode,
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
    // Guard against disabled feature flags
    if (!enableVoucherBuy && (data.adults > 0 || data.elderly > 0)) {
      return toast({
        title: "Indisponível",
        description: "Compra de voucher normal está desativada",
      });
    }
    if (
      !enablePoolVoucherBuy &&
      (data.adults_pool > 0 || data.elderly_pool > 0)
    ) {
      return toast({
        title: "Indisponível",
        description: "Compra de voucher com piscina está desativada",
      });
    }
    if (!enableHalfPriceVoucherBuy && data.elderly > 0) {
      return toast({
        title: "Indisponível",
        description: "Compra de voucher meia entrada está desativada",
      });
    }
    if (!enableHalfPricePoolVoucherBuy && data.elderly_pool > 0) {
      return toast({
        title: "Indisponível",
        description: "Compra de voucher meia entrada com piscina está desativada",
      });
    }
    if (
      data.adults + data.elderly + data.adults_pool + data.elderly_pool ===
      0
    ) {
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
      const voucher = await addVoucher.mutateAsync({
        ...completeData,
        testMode,
      });
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

  // Check if all voucher purchase options are disabled
  if (!enableVoucherBuy && !enablePoolVoucherBuy && !enableHalfPriceVoucherBuy && !enableHalfPricePoolVoucherBuy) {
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
                      <p className="text-base font-bold">Inteira</p>
                      <p className="text-sm">(de 9 a 59 anos)</p>
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

                  {enableHalfPriceVoucherBuy && (
                    <div className="space-y-4 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="flex flex-col">
                          <p className="text-base font-bold">Meia</p>
                          <p className="text-sm">(+60 anos e especiais)</p>
                          <p className="text-sm">
                            R${" "}
                            {elderlyVoucherPrice.toFixed(2).replace(".", ",")}
                          </p>
                        </Label>
                        <div className="w-fit">
                          <Controller
                            name="elderly"
                            control={control}
                            render={({ field }) => (
                              <NumberInput
                                id="elderly"
                                minValue={0}
                                maxValue={maxElderly}
                                selectedValue={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                      </div>
                        {formValues.elderly > 0 && (
                          <p className="text-base font-medium text-yellow-950 bg-yellow-50 rounded-md px-3 py-2">
                            Necessário apresentar documento de identificação
                          </p>
                        )}
                      {errors.elderly && (
                        <p className="text-base font-medium text-red-400">
                          {errors.elderly?.message}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {enablePoolVoucherBuy && (
                <>
                  <div className="flex items-center justify-between gap-2 py-4">
                    <Label className="flex flex-col">
                      <p className="text-base font-bold">Área da Piscina</p>
                      <p className="text-sm">
                        R$ {poolVoucherPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </Label>
                    <div className="w-fit">
                      <Controller
                        name="adults_pool"
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            id="adults_pool"
                            minValue={0}
                            maxValue={maxAdultsPool}
                            selectedValue={field.value}
                            onChange={field.onChange}
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

                  {enableHalfPricePoolVoucherBuy && (
                    <div className="flex items-center justify-between gap-2 py-4">
                      <Label className="flex flex-col">
                        <p className="text-base font-bold">Meia (Piscina)</p>
                        <p className="text-sm">(+60 anos e especiais)</p>
                        <p className="text-sm">
                          R${" "}
                          {poolElderlyVoucherPrice
                            .toFixed(2)
                            .replace(".", ",")}
                        </p>
                      </Label>
                      <div className="w-fit">
                        <Controller
                          name="elderly_pool"
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              id="elderly_pool"
                              minValue={0}
                              maxValue={maxElderlyPool}
                              selectedValue={field.value}
                              onChange={field.onChange}
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
                  )}
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
