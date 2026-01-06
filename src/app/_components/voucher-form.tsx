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
  calculatePrice,
  formatVoucher,
  getElderlyVoucherPrice,
  getPoolElderlyVoucherPrice,
  getPoolVoucherPrice,
  getVoucherPrice,
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
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useTrpcErrorHandler } from "@/hooks/use-trpc-error-handler";
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
  const { isOnline } = useNetworkStatus();
  const { handleError, showErrorToast, showSuccessToast } =
    useTrpcErrorHandler();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [init_point, setInitPoint] = useState("");
  const [payment_sucess_url, setPaymentSuccessUrl] = useState("");
  const [referrerURL, setReferrerURL] = useState<string | null>(null);

  const utils = api.useUtils();

  // Get all settings from database using a single query
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const settingsQuery = api.settings.getAll.useQuery();

  // Destructure settings with defaults
  // Safely access data property, handling potential errors
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const settingsData = settingsQuery.data;
  const {
    "disabled.days": disabledDays = [],
    "max.intended.days": maxIntendedDays = 60,
    "form.message": formMessage = "",
    "enable.voucher.buy": enableVoucherBuy = true,
    "enable.voucher.pool.buy": enablePoolVoucherBuy = true,
    "enable.voucher.half-price.buy": enableHalfPriceVoucherBuy = true,
    "enable.voucher.half-price.pool.buy": enableHalfPricePoolVoucherBuy = false,
  } = (settingsData ?? {}) as {
    "disabled.days"?: string[];
    "max.intended.days"?: number;
    "form.message"?: string;
    "enable.voucher.buy"?: boolean;
    "enable.voucher.pool.buy"?: boolean;
    "enable.voucher.half-price.buy"?: boolean;
    "enable.voucher.half-price.pool.buy"?: boolean;
  };

  async function checkPaymentStatus(code: string) {
    const voucher = (await utils.voucher.findByCode.fetch({ code })) as Voucher;
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
  const addVoucher = api.voucher.create.useMutation({
    onError: (error) => {
      handleError(
        error,
        "Erro ao criar o voucher. Por favor, tente novamente.",
      );
    },
  });
  const mercadopago = api.mercadopago.create.useMutation({
    onError: (error) => {
      handleError(
        error,
        "Erro ao criar a preferência de pagamento. Por favor, tente novamente.",
      );
    },
  });

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
      unit_price: testMode
        ? 0.01
        : calculatePrice(
            data.adults,
            data.elderly,
            data.adults_pool,
            data.elderly_pool,
          ),
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
    // Check network status before submitting
    if (!isOnline) {
      return showErrorToast(
        "Sem conexão",
        "Você está offline. Verifique sua conexão com a internet e tente novamente.",
      );
    }

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
        description:
          "Compra de voucher meia entrada com piscina está desativada",
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
      if (!res?.id || !res?.init_point) {
        throw new Error("Falha ao criar preferência de pagamento");
      }
      await addCookieVoucher(rcode);
      const preference_id = res.id;
      const completeData = formatVoucher({
        ...data,
        preference_id,
        code: rcode,
      });
      // Override price for test mode
      if (testMode) {
        completeData.price = 0.01;
      }
      const voucher = await addVoucher.mutateAsync(completeData);
      if (!voucher) {
        setIsLoading(false);
        return handleError(
          new Error("Failed to create voucher"),
          "Erro ao criar o voucher. Por favor, atualize a página e tente novamente.",
        );
      }
      setInitPoint(res.init_point);
      if (referrerURL) {
        try {
          await createReferrer(rcode, referrerURL);
        } catch (error) {
          // Don't fail the whole process if referrer creation fails
          console.error("Error creating referrer:", error);
        }
      }
      setIsLoading(false);
      showSuccessToast(
        "Voucher criado com sucesso!",
        "Redirecionando para o pagamento...",
      );
    } catch (error) {
      setIsLoading(false);
      handleError(
        error,
        "Erro ao processar o voucher. Por favor, tente novamente.",
      );
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
  if (
    !enableVoucherBuy &&
    !enablePoolVoucherBuy &&
    !enableHalfPriceVoucherBuy &&
    !enableHalfPricePoolVoucherBuy
  ) {
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
                        R$ {getVoucherPrice().toFixed(2).replace(".", ",")}
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
                            maxValue={20}
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
                            {getElderlyVoucherPrice()
                              .toFixed(2)
                              .replace(".", ",")}
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
                                maxValue={20}
                                selectedValue={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                      </div>
                      {formValues.elderly > 0 && (
                        <p className="rounded-md bg-yellow-50 px-3 py-2 text-base font-medium text-yellow-950">
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
                        R$ {getPoolVoucherPrice().toFixed(2).replace(".", ",")}
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
                            maxValue={20}
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
                          {getPoolElderlyVoucherPrice()
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
                              maxValue={20}
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
                          const maxDays =
                            typeof maxIntendedDays === "number"
                              ? maxIntendedDays
                              : 60;
                          maxDate.setDate(today.getDate() + maxDays);

                          // Check if date is in the past or beyond max date
                          if (date < yesterday || date > maxDate) {
                            return true;
                          }

                          // Check if date is in the disabled days list
                          const dateStr = date.toISOString().slice(0, 10); // Format as YYYY-MM-DD
                          return (
                            Array.isArray(disabledDays) &&
                            disabledDays.includes(dateStr)
                          );
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

          <h1 className="font-bold">{`Valor: R$${(testMode ? 0.01 : calculatePrice(formValues.adults, formValues.elderly, formValues.adults_pool, formValues.elderly_pool)).toFixed(2).replace(".", ",")}`}</h1>

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
        {!isOnline && (
          <div className="my-4 rounded-xl bg-yellow-500/20 p-4 text-center text-base font-medium text-yellow-200">
            Você está offline. Verifique sua conexão com a internet.
          </div>
        )}
      </div>
    </div>
  );
}
