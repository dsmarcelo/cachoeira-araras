/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { withSentryConfig } from "@sentry/nextjs";

await import("./src/env.js");

const apiCorsHeaders = [
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Access-Control-Allow-Origin", value: "*" },
  {
    key: "Access-Control-Allow-Methods",
    value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  },
  {
    key: "Access-Control-Allow-Headers",
    value:
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  },
];

/** @type {import("next").NextConfig} */
const config = {
  allowedDevOrigins: ["tough-totally-honeybee.ngrok-free.app"],
  images: {
    // Next.js 16 requires every <Image quality={...}> value to be allowlisted.
    // The gallery uses quality={60}; keep the default 75 available too.
    qualities: [60, 75],
    // Disable Next.js image optimizer to avoid serverless/edge image requests on Vercel Free
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.vercel.app",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // matching og image API routes
        source: "/api/og",
        headers: apiCorsHeaders,
      },
      {
        // matching Mercado Pago webhook API route
        source: "/api/webhook",
        headers: apiCorsHeaders,
      },
      {
        // matching legacy/plural Mercado Pago webhook API route
        source: "/api/webhooks",
        headers: apiCorsHeaders,
      },
    ];
  },
};

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  telemetry: false,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
