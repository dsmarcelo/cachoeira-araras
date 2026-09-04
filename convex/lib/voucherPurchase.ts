import { getSaoPauloDateKey } from "../../src/lib/utils/date";
import type { SettingValueMap } from "./settings";

/**
 * The pure core of a voucher purchase: given the visitor's chosen entry
 * counts and visit date plus the settings in force, decide whether the
 * purchase is allowed and what it costs. Kept free of I/O (no database, no
 * Mercado Pago, no auth) so its four independent branch families —
 * quantity validity, per-type limits, enable toggles, and the visit-date
 * window including disabled days — are each a direct unit test rather than
 * a scenario that needs a Mercado Pago stub to reach.
 *
 * The Convex action (`convex/vouchers.ts` `startCheckout`) is the only
 * caller; it supplies settings fetched from the database and the price this
 * function returns is what actually gets charged, never a client-sent price.
 */
export interface VoucherPurchaseInput {
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  /** The visitor's chosen visit date, as a "YYYY-MM-DD" Sao Paulo date key. */
  visitDate: string;
  testMode?: boolean;
}

export interface ValidateVoucherPurchaseOptions {
  /** Whether the caller's verified role is allowed to use test-mode pricing. */
  canUseTestMode?: boolean;
  /** Defaults to now; overridable so date-window tests are deterministic. */
  now?: Date;
  settings: SettingValueMap;
}

export interface VoucherPurchaseValidationResult {
  priceCents: number;
}

type QuantityKey = "adults" | "elderly" | "adultsPool" | "elderlyPool";

const quantityLabels: Record<QuantityKey, string> = {
  adults: "inteiras",
  elderly: "meias",
  adultsPool: "piscina",
  elderlyPool: "meias com piscina",
};

/** Test-mode purchases are charged the smallest possible amount: one cent. */
const TEST_MODE_PRICE_CENTS = 1;

export function calculateVoucherPurchasePriceCents({
  input,
  settings,
}: {
  input: VoucherPurchaseInput;
  settings: SettingValueMap;
}): number {
  const priceCents = settings["voucher.price"];
  const poolPriceCents = settings["voucher.pool.price"];

  return (
    input.adults * priceCents +
    Math.round(input.elderly * (priceCents / 2)) +
    input.adultsPool * poolPriceCents +
    Math.round(input.elderlyPool * (poolPriceCents / 2))
  );
}

export function validateVoucherPurchase(
  input: VoucherPurchaseInput,
  options: ValidateVoucherPurchaseOptions,
): VoucherPurchaseValidationResult {
  if (input.testMode === true && options.canUseTestMode !== true) {
    throw new Error("Modo de teste disponível apenas para equipe autorizada.");
  }

  validateQuantities(input);
  validateEnabledOptions(input, options.settings);
  validateQuantityLimits(input, options.settings);
  validateVisitDate(input.visitDate, options);

  return {
    priceCents:
      input.testMode === true
        ? TEST_MODE_PRICE_CENTS
        : calculateVoucherPurchasePriceCents({
            input,
            settings: options.settings,
          }),
  };
}

function validateQuantities(input: VoucherPurchaseInput) {
  const quantities: Array<[QuantityKey, number]> = [
    ["adults", input.adults],
    ["elderly", input.elderly],
    ["adultsPool", input.adultsPool],
    ["elderlyPool", input.elderlyPool],
  ];

  for (const [key, value] of quantities) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Quantidade inválida para ${quantityLabels[key]}.`);
    }
  }

  const total = quantities.reduce((sum, [, value]) => sum + value, 0);

  if (total === 0) {
    throw new Error("Informe ao menos uma entrada para comprar.");
  }
}

function validateEnabledOptions(
  input: VoucherPurchaseInput,
  settings: SettingValueMap,
) {
  if (
    !settings["enable.voucher.buy"] &&
    (input.adults > 0 || input.elderly > 0)
  ) {
    throw new Error("Compra de voucher normal está desativada.");
  }

  if (!settings["enable.voucher.half-price.buy"] && input.elderly > 0) {
    throw new Error("Compra de voucher meia entrada está desativada.");
  }

  if (
    !settings["enable.voucher.pool.buy"] &&
    (input.adultsPool > 0 || input.elderlyPool > 0)
  ) {
    throw new Error("Compra de voucher com piscina está desativada.");
  }

  if (
    !settings["enable.voucher.half-price.pool.buy"] &&
    input.elderlyPool > 0
  ) {
    throw new Error(
      "Compra de voucher meia entrada com piscina está desativada.",
    );
  }
}

function validateQuantityLimits(
  input: VoucherPurchaseInput,
  settings: SettingValueMap,
) {
  const limits: Array<[QuantityKey, number]> = [
    ["adults", settings["voucher.max.quantity.adults"]],
    ["elderly", settings["voucher.max.quantity.elderly"]],
    ["adultsPool", settings["voucher.max.quantity.adults.pool"]],
    ["elderlyPool", settings["voucher.max.quantity.elderly.pool"]],
  ];

  for (const [key, limit] of limits) {
    if (input[key] > limit) {
      throw new Error(
        `Quantidade de ${quantityLabels[key]} acima do limite permitido.`,
      );
    }
  }
}

function validateVisitDate(
  visitDate: string,
  options: ValidateVoucherPurchaseOptions,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    throw new Error("Data de visita inválida.");
  }

  const todayKey = getSaoPauloDateKey(options.now);
  const today = dateKeyToUtcDay(todayKey);
  const visitDay = dateKeyToUtcDay(visitDate);
  const maxDate = new Date(today);
  maxDate.setUTCDate(
    today.getUTCDate() + options.settings["max.intended.days"],
  );

  if (visitDay < today) {
    throw new Error("Data de visita não pode estar no passado.");
  }

  if (visitDay > maxDate) {
    throw new Error("Data de visita além do limite permitido.");
  }

  if (options.settings["disabled.days"].includes(visitDate)) {
    throw new Error("Data de visita indisponível.");
  }
}

function dateKeyToUtcDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
