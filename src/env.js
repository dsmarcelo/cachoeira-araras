import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
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
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      (str) => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    DATABASE_URL: z.string(),
    URL: z.string(),
    MERCADOPAGO_TOKEN: z.string(),
    WEBHOOK_URL: z.string(),
    CRON_SECRET: z.string(),
    FACEBOOK_ACCESS_TOKEN: z.string().optional(),
    FACEBOOK_PIXEL_ID: z.string().optional(),
    GOOGLE_ANALYTICS_API_SECRET: z.string().optional(),
    GOOGLE_ANALYTICS_MEASUREMENT_ID: z.string().optional(),
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
    NEXT_PUBLIC_VOUCHER_POOL_PRICE: z.coerce.number().default(70),
    NEXT_PUBLIC_ALERT_MESSAGE: z.string().optional(),
    // Enables client-side data saver behavior to reduce requests on Vercel Free
    NEXT_PUBLIC_DATA_SAVER: z.coerce.boolean().default(false),
    // Toggle Vercel Analytics on/off at runtime (off reduces /_vercel/insights requests)
    NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
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
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    URL: process.env.URL,
    MERCADOPAGO_TOKEN: process.env.MERCADOPAGO_TOKEN,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    FACEBOOK_PIXEL_ID: process.env.FACEBOOK_PIXEL_ID,
    GOOGLE_ANALYTICS_API_SECRET: process.env.GOOGLE_ANALYTICS_API_SECRET,
    GOOGLE_ANALYTICS_MEASUREMENT_ID:
      process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID,
    NEXT_PUBLIC_MAX_INTENDED_DAYS: process.env.NEXT_PUBLIC_MAX_INTENDED_DAYS,
    NEXT_PUBLIC_VOUCHER_PRICE: process.env.NEXT_PUBLIC_VOUCHER_PRICE,
    NEXT_PUBLIC_VOUCHER_POOL_PRICE: process.env.NEXT_PUBLIC_VOUCHER_POOL_PRICE,
    NEXT_PUBLIC_ALERT_MESSAGE: process.env.NEXT_PUBLIC_ALERT_MESSAGE,
    NEXT_PUBLIC_DATA_SAVER: process.env.NEXT_PUBLIC_DATA_SAVER,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
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
