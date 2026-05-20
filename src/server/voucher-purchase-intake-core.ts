import { randomInt } from "node:crypto";

import { TRPCError } from "@trpc/server";

import type { SettingValueMap } from "../lib/settings";
import { validateVoucherPurchase } from "./voucher-purchase.ts";

export interface StartVoucherCheckoutInput {
  name: string;
  phone: string;
  adults: number;
  elderly: number;
  adults_pool: number;
  elderly_pool: number;
  intendedDate: Date;
  testMode?: boolean;
  referrerUrl?: string | null;
}

export interface StartVoucherCheckoutOptions {
  canUseTestMode?: boolean;
}

export interface StartVoucherCheckoutResult {
  code: string;
  preferenceId: string;
  initPoint: string;
  price: number;
}

interface CheckoutPreferenceInput {
  code: string;
  description: string;
  price: number;
  name: string;
  surname: string;
  phone: string;
  adults: number;
  elderly: number;
  adults_pool: number;
  elderly_pool: number;
  intendedDate: Date;
  testMode: boolean;
}

interface CheckoutPreferenceResult {
  id: string | null | undefined;
  initPoint: string | null | undefined;
}

interface PendingVoucherInput {
  name: string;
  phone: string;
  adults: number;
  elderly: number;
  adults_pool: number;
  elderly_pool: number;
  code: string;
  price: number;
  preferenceId: string;
  expiresAt: Date;
}

interface ReferrerAttributionInput {
  voucherCode: string;
  referrer: string;
  url: string;
}

interface VoucherPurchaseIntakeDeps {
  createCheckoutPreference: (
    input: CheckoutPreferenceInput,
  ) => Promise<CheckoutPreferenceResult>;
  createPendingVoucher: (input: PendingVoucherInput) => Promise<unknown>;
  createReferrerAttribution: (
    input: ReferrerAttributionInput,
  ) => Promise<unknown>;
  findVoucherByCode: (code: string) => Promise<object | null>;
  generateCode: () => string;
  getSettings: () => Promise<SettingValueMap>;
  isUniqueConstraintError: (error: unknown) => boolean;
  logger?: Pick<Console, "error" | "warn">;
}

const maxVoucherCodeAttempts = 10;

export function createVoucherPurchaseIntake(deps: VoucherPurchaseIntakeDeps) {
  const logger = deps.logger ?? console;

  return async function startVoucherCheckout(
    input: StartVoucherCheckoutInput,
    options: StartVoucherCheckoutOptions = {},
  ): Promise<StartVoucherCheckoutResult> {
    const settings = await deps.getSettings();
    const validation = validateVoucherPurchase(
      {
        adults: input.adults,
        elderly: input.elderly,
        adults_pool: input.adults_pool,
        elderly_pool: input.elderly_pool,
        intendedDate: input.intendedDate,
        testMode: input.testMode,
      },
      {
        canUseTestMode: options.canUseTestMode,
        settings,
      },
    );

    for (let attempt = 1; attempt <= maxVoucherCodeAttempts; attempt += 1) {
      const code = deps.generateCode();
      const existingVoucher = await deps.findVoucherByCode(code);
      if (existingVoucher) {
        continue;
      }

      const { firstName, surname } = splitCustomerName(input.name);
      const preference = await deps.createCheckoutPreference({
        code,
        description: formatVoucherCheckoutDescription({
          adults: input.adults,
          elderly: input.elderly,
          adults_pool: input.adults_pool,
          elderly_pool: input.elderly_pool,
          phone: input.phone,
          code,
        }),
        price: validation.price,
        name: firstName,
        surname,
        phone: input.phone,
        adults: input.adults,
        elderly: input.elderly,
        adults_pool: input.adults_pool,
        elderly_pool: input.elderly_pool,
        intendedDate: input.intendedDate,
        testMode: input.testMode === true,
      });

      if (!preference.id || !preference.initPoint) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar preferência de pagamento.",
        });
      }

      try {
        await deps.createPendingVoucher({
          name: input.name,
          phone: input.phone,
          adults: input.adults,
          elderly: input.elderly,
          adults_pool: input.adults_pool,
          elderly_pool: input.elderly_pool,
          code,
          price: validation.price,
          preferenceId: preference.id,
          expiresAt: input.intendedDate,
        });
      } catch (error) {
        logger.error("Voucher checkout preference created without voucher", {
          code,
          preferenceId: preference.id,
          error,
        });

        if (deps.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }

      await persistReferrerAttribution({
        code,
        deps,
        logger,
        referrerUrl: input.referrerUrl,
      });

      return {
        code,
        preferenceId: preference.id,
        initPoint: preference.initPoint,
        price: validation.price,
      };
    }

    throw new TRPCError({
      code: "CONFLICT",
      message: "Não foi possível gerar um código de voucher disponível.",
    });
  };
}

function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    surname: parts.slice(1).join(" "),
  };
}

export function generateVoucherCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";

  for (let index = 0; index < 4; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }

  return code;
}

export function classifyReferrer(referrerUrl: string): string {
  switch (true) {
    case referrerUrl.includes("fbclid"):
      return "Facebook";
    case referrerUrl.includes("gclid"):
      return "Google";
    case referrerUrl.includes("igshid"):
      return "Instagram";
    case referrerUrl.includes("mail.google"):
      return "Gmail";
    default:
      return "";
  }
}

function formatVoucherCheckoutDescription({
  adults,
  elderly,
  adults_pool,
  elderly_pool,
  phone,
  code,
}: {
  adults: number;
  elderly: number;
  adults_pool: number;
  elderly_pool: number;
  phone: string;
  code: string;
}): string {
  let description = `Voucher com código ${code}`;

  if (adults > 0 && elderly > 0) {
    description += `, ${adults} entrada(s) inteiras e ${elderly} entrada(s) meias`;
  } else if (adults > 0) {
    description += `, ${adults} entrada(s) inteiras`;
  } else if (elderly > 0) {
    description += `, ${elderly} entrada(s) meias`;
  }

  if (adults_pool > 0 && elderly_pool > 0) {
    description += `, ${adults_pool} acesso(s) a piscina (inteiras) e ${elderly_pool} acesso(s) a piscina (meias)`;
  } else if (adults_pool > 0) {
    description += `, ${adults_pool} acesso(s) a piscina (inteiras)`;
  } else if (elderly_pool > 0) {
    description += `, ${elderly_pool} acesso(s) a piscina (meias)`;
  }

  description += `. Telefone: ${phone}`;
  return description;
}

async function persistReferrerAttribution({
  code,
  deps,
  logger,
  referrerUrl,
}: {
  code: string;
  deps: VoucherPurchaseIntakeDeps;
  logger: Pick<Console, "warn">;
  referrerUrl?: string | null;
}) {
  const normalizedUrl = referrerUrl?.trim();
  if (!normalizedUrl) {
    return;
  }

  try {
    await deps.createReferrerAttribution({
      voucherCode: code,
      referrer: classifyReferrer(normalizedUrl),
      url: normalizedUrl,
    });
  } catch (error) {
    logger.warn("Voucher checkout referrer attribution failed", {
      code,
      referrerUrl: normalizedUrl,
      error,
    });
  }
}
