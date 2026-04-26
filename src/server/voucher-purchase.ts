import { TRPCError } from "@trpc/server";

import type { SettingValueMap } from "../lib/settings";

export interface VoucherPurchaseInput {
  adults: number;
  elderly: number;
  adults_pool: number;
  elderly_pool: number;
  intendedDate: Date | null | undefined;
  testMode?: boolean;
}

interface ValidateVoucherPurchaseOptions {
  canUseTestMode?: boolean;
  now?: Date;
  settings: SettingValueMap;
}

export interface VoucherPurchaseValidationResult {
  price: number;
}

type QuantityKey = keyof Pick<
  VoucherPurchaseInput,
  "adults" | "elderly" | "adults_pool" | "elderly_pool"
>;

const quantityLabels: Record<QuantityKey, string> = {
  adults: "inteiras",
  elderly: "meias",
  adults_pool: "piscina",
  elderly_pool: "meias com piscina",
};

export function calculateVoucherPurchasePrice({
  input,
  settings,
}: {
  input: VoucherPurchaseInput;
  settings: SettingValueMap;
}): number {
  const voucherPrice = settings["voucher.price"];
  const poolVoucherPrice = settings["voucher.pool.price"];

  return (
    input.adults * voucherPrice +
    input.elderly * (voucherPrice / 2) +
    input.adults_pool * poolVoucherPrice +
    input.elderly_pool * (poolVoucherPrice / 2)
  );
}

export function validateVoucherPurchase(
  input: VoucherPurchaseInput,
  options: ValidateVoucherPurchaseOptions,
): VoucherPurchaseValidationResult {
  if (input.testMode === true && options.canUseTestMode !== true) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Modo de teste disponível apenas para equipe autorizada.",
    });
  }

  validateQuantities(input);
  validateEnabledOptions(input, options.settings);
  validateQuantityLimits(input, options.settings);
  validateIntendedDate(input.intendedDate, options);

  return {
    price:
      input.testMode === true
        ? 0.01
        : calculateVoucherPurchasePrice({
            input,
            settings: options.settings,
          }),
  };
}

function validateQuantities(input: VoucherPurchaseInput) {
  const quantities: Array<[QuantityKey, number]> = [
    ["adults", input.adults],
    ["elderly", input.elderly],
    ["adults_pool", input.adults_pool],
    ["elderly_pool", input.elderly_pool],
  ];

  for (const [key, value] of quantities) {
    if (!Number.isInteger(value) || value < 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Quantidade inválida para ${quantityLabels[key]}.`,
      });
    }
  }

  const total = quantities.reduce((sum, [, value]) => sum + value, 0);

  if (total === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe ao menos uma entrada para comprar.",
    });
  }
}

function validateEnabledOptions(
  input: VoucherPurchaseInput,
  settings: SettingValueMap,
) {
  if (!settings["enable.voucher.buy"] && (input.adults > 0 || input.elderly > 0)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compra de voucher normal está desativada.",
    });
  }

  if (!settings["enable.voucher.half-price.buy"] && input.elderly > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compra de voucher meia entrada está desativada.",
    });
  }

  if (
    !settings["enable.voucher.pool.buy"] &&
    (input.adults_pool > 0 || input.elderly_pool > 0)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compra de voucher com piscina está desativada.",
    });
  }

  if (
    !settings["enable.voucher.half-price.pool.buy"] &&
    input.elderly_pool > 0
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compra de voucher meia entrada com piscina está desativada.",
    });
  }
}

function validateQuantityLimits(
  input: VoucherPurchaseInput,
  settings: SettingValueMap,
) {
  const limits: Array<[QuantityKey, number]> = [
    ["adults", settings["voucher.max.quantity.adults"]],
    ["elderly", settings["voucher.max.quantity.elderly"]],
    ["adults_pool", settings["voucher.max.quantity.adults.pool"]],
    ["elderly_pool", settings["voucher.max.quantity.elderly.pool"]],
  ];

  for (const [key, limit] of limits) {
    if (input[key] > limit) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Quantidade de ${quantityLabels[key]} acima do limite permitido.`,
      });
    }
  }
}

function validateIntendedDate(
  intendedDate: Date | null | undefined,
  options: ValidateVoucherPurchaseOptions,
) {
  if (!intendedDate || Number.isNaN(intendedDate.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data de visita inválida.",
    });
  }

  const todayKey = formatBrazilianDateKey(options.now ?? new Date());
  const visitKey = formatBrazilianDateKey(intendedDate);
  const today = dateKeyToUtcDay(todayKey);
  const visitDay = dateKeyToUtcDay(visitKey);
  const maxDate = new Date(today);
  maxDate.setUTCDate(today.getUTCDate() + options.settings["max.intended.days"]);

  if (visitDay < today) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data de visita não pode estar no passado.",
    });
  }

  if (visitDay > maxDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data de visita além do limite permitido.",
    });
  }

  if (options.settings["disabled.days"].includes(visitKey)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data de visita indisponível.",
    });
  }
}

function formatBrazilianDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Data de visita inválida.",
    });
  }

  return `${year}-${month}-${day}`;
}

function dateKeyToUtcDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
