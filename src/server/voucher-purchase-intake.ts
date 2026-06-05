import "server-only";

import { Prisma } from "@prisma/client";
import { MercadoPagoConfig, Preference } from "mercadopago";

import { env } from "@/env";
import { getAllSettings } from "@/lib/settings";
import { capturePaymentFlowException, startPaymentFlowSpan } from "@/lib/sentry/payment";
import {
  buildMercadoPagoWebhookUrl,
  normalizePublicBaseUrl,
  resolveWebhookBaseForCheckout,
} from "@/server/mercadopago-checkout";
import { db } from "@/server/db";
import {
  createVoucherPurchaseIntake,
  generateVoucherCode,
  type StartVoucherCheckoutInput,
  type StartVoucherCheckoutOptions,
} from "@/server/voucher-purchase-intake-core";

export type { StartVoucherCheckoutInput, StartVoucherCheckoutResult } from "@/server/voucher-purchase-intake-core";

export async function startVoucherCheckout(
  input: StartVoucherCheckoutInput,
  options: StartVoucherCheckoutOptions = {},
) {
  try {
    const intake = createVoucherPurchaseIntake({
      createCheckoutPreference: createMercadoPagoCheckoutPreference,
      createPendingVoucher: async (voucher) => {
        return await db.voucher.create({
          data: {
            name: voucher.name,
            phone: voucher.phone,
            adults: voucher.adults,
            elderly: voucher.elderly,
            adults_pool: voucher.adults_pool,
            elderly_pool: voucher.elderly_pool,
            code: voucher.code,
            price: voucher.price,
            valid: false,
            status: "pending",
            preference_id: voucher.preferenceId,
            expires_at: voucher.expiresAt,
            gclid: voucher.gclid,
          },
        });
      },
      createReferrerAttribution: async (referrer) => {
        return await db.referrer.create({
          data: referrer,
        });
      },
      findVoucherByCode: async (code) => {
        return await db.voucher.findFirst({
          where: {
            code,
          },
          select: {
            code: true,
          },
        });
      },
      generateCode: generateVoucherCode,
      getSettings: getAllSettings,
      isUniqueConstraintError,
    });

    return await intake(input, options);
  } catch (error) {
    capturePaymentFlowException(error, "create_preference", {
      adults: input.adults,
      elderly: input.elderly,
      adults_pool: input.adults_pool,
      elderly_pool: input.elderly_pool,
      intendedDate: input.intendedDate,
      testMode: input.testMode,
    });
    throw error;
  }
}

function createMercadoPagoClient(idempotencyKey: string) {
  return new MercadoPagoConfig({
    accessToken: env.MERCADOPAGO_TOKEN,
    options: { timeout: 5000, idempotencyKey },
  });
}

async function createMercadoPagoCheckoutPreference(input: {
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
}) {
  const siteBase = resolveSiteBaseForCheckout();
  const webhookBase = resolveWebhookBaseForCheckout({
    siteBaseUrl: siteBase,
    webhookUrl: env.WEBHOOK_URL,
  });
  const preference = new Preference(createMercadoPagoClient(input.code));

  const response = await startPaymentFlowSpan(
    "create_preference",
    "Create Mercado Pago checkout preference",
    {
      voucherCode: input.code,
      adults: input.adults,
      elderly: input.elderly,
      adults_pool: input.adults_pool,
      elderly_pool: input.elderly_pool,
      intendedDate: input.intendedDate,
      testMode: input.testMode,
      price: input.price,
    },
    () =>
      preference.create({
        body: {
          items: [
            {
              id: input.code,
              description: input.description,
              title: `Voucher ${input.code}`,
              quantity: 1,
              unit_price: input.price,
              currency_id: "BRL",
            },
          ],
          payer: {
            name: input.name,
            surname: input.surname,
            phone: formatMercadoPagoPhone(input.phone),
          },
          back_urls: {
            success: `${siteBase}/pagamento/`,
            failure: `${siteBase}/pagamento/`,
            pending: `${siteBase}/pagamento/`,
          },
          external_reference: input.code,
          expires: true,
          auto_return: "approved",
          expiration_date_from: new Date(Date.now()).toISOString(),
          expiration_date_to: new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 10,
          ).toISOString(),
          payment_methods: {
            excluded_payment_methods: [
              {
                id: "bolbradesco",
              },
              {
                id: "pec",
              },
            ],
          },
          statement_descriptor: "Cachoeira das Araras",
          notification_url: buildMercadoPagoWebhookUrl(webhookBase),
        },
      }),
  );

  return {
    id: response.id,
    initPoint: response.init_point,
  };
}

function resolveSiteBaseForCheckout(): string {
  const primary = (env.URL ?? "").trim();
  if (primary) return normalizePublicBaseUrl(primary);
  if (env.NEXT_PUBLIC_VERCEL_URL?.trim()) {
    return normalizePublicBaseUrl(
      `https://${env.NEXT_PUBLIC_VERCEL_URL.trim()}`,
    );
  }
  if (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return normalizePublicBaseUrl(
      `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL.trim()}`,
    );
  }
  return "http://localhost:3000";
}

function formatMercadoPagoPhone(phone: string) {
  return {
    area_code: phone.substring(0, 2),
    number: phone.substring(2),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
