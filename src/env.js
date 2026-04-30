import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** @param {string} base */
function normalizePublicBaseUrl(base) {
  return base.replace(/\/+$/, "");
}

/** @param {unknown} value */
function resolvePublicBaseUrl(value) {
  if (typeof value === "string") {
    return normalizePublicBaseUrl(value.trim());
  }

  return value;
}

/** @param {unknown} value */
function resolveOptionalPublicBaseUrl(value) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }

    return normalizePublicBaseUrl(trimmedValue);
  }

  return value;
}

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  server: {
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    ADMIN_PASSWORD_HASH:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    EMPLOYEE_PASSWORD_HASH:
      process.env.NODE_ENV === "production"
        ? z.string().optional()
        : z.string().optional(),
    URL: z.preprocess(resolvePublicBaseUrl, z.string().url()),
    DATABASE_URL: z.string(),
    MERCADOPAGO_TOKEN: z.string(),
    WEBHOOK_URL: z.preprocess(
      resolveOptionalPublicBaseUrl,
      z.string().url().optional(),
    ),
    WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    CRON_SECRET: z.string(),
    FACEBOOK_ACCESS_TOKEN: z.string().optional(),
    FACEBOOK_PIXEL_ID: z.string().optional(),
    GOOGLE_ANALYTICS_API_SECRET: z.string().optional(),
    GOOGLE_ANALYTICS_MEASUREMENT_ID: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
    VERCEL_URL: z.string().optional(),
    PORT: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_MAX_INTENDED_DAYS: z.coerce.number().default(30),
    NEXT_PUBLIC_VOUCHER_PRICE: z.coerce.number().default(50),
    NEXT_PUBLIC_POOL_VOUCHER_PRICE: z.coerce.number().default(70),
    NEXT_PUBLIC_FACEBOOK_PIXEL_ID: z.string().optional(),
    NEXT_PUBLIC_ALERT_MESSAGE: z.string().optional(),
    // Toggle Vercel Analytics on/off at runtime (off reduces /_vercel/insights requests)
    NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .optional(),
    NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    EMPLOYEE_PASSWORD_HASH: process.env.EMPLOYEE_PASSWORD_HASH,
    DATABASE_URL: process.env.DATABASE_URL,
    URL: process.env.URL,
    MERCADOPAGO_TOKEN: process.env.MERCADOPAGO_TOKEN,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    FACEBOOK_PIXEL_ID: process.env.FACEBOOK_PIXEL_ID,
    GOOGLE_ANALYTICS_API_SECRET: process.env.GOOGLE_ANALYTICS_API_SECRET,
    GOOGLE_ANALYTICS_MEASUREMENT_ID:
      process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
    VERCEL_URL: process.env.VERCEL_URL,
    PORT: process.env.PORT,
    NEXT_PUBLIC_MAX_INTENDED_DAYS: process.env.NEXT_PUBLIC_MAX_INTENDED_DAYS,
    NEXT_PUBLIC_VOUCHER_PRICE: process.env.NEXT_PUBLIC_VOUCHER_PRICE,
    NEXT_PUBLIC_POOL_VOUCHER_PRICE: process.env.NEXT_PUBLIC_POOL_VOUCHER_PRICE,
    NEXT_PUBLIC_FACEBOOK_PIXEL_ID: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
    NEXT_PUBLIC_ALERT_MESSAGE: process.env.NEXT_PUBLIC_ALERT_MESSAGE,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
