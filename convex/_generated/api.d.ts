/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authAdmin from "../authAdmin.js";
import type * as crons from "../crons.js";
import type * as finance from "../finance.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_financeSummary from "../lib/financeSummary.js";
import type * as lib_mercadopago from "../lib/mercadopago.js";
import type * as lib_mercadopagoError from "../lib/mercadopagoError.js";
import type * as lib_mercadopagoOperations from "../lib/mercadopagoOperations.js";
import type * as lib_paymentOperation from "../lib/paymentOperation.js";
import type * as lib_paymentReversal from "../lib/paymentReversal.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_refundFailure from "../lib/refundFailure.js";
import type * as lib_serviceAuth from "../lib/serviceAuth.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_siteUrl from "../lib/siteUrl.js";
import type * as lib_voucherCode from "../lib/voucherCode.js";
import type * as lib_voucherPurchase from "../lib/voucherPurchase.js";
import type * as lib_voucherReschedule from "../lib/voucherReschedule.js";
import type * as lib_voucherSearch from "../lib/voucherSearch.js";
import type * as lib_voucherWrites from "../lib/voucherWrites.js";
import type * as maintenance from "../maintenance.js";
import type * as mercadopago from "../mercadopago.js";
import type * as migrations from "../migrations.js";
import type * as paymentOperations from "../paymentOperations.js";
import type * as paymentSync from "../paymentSync.js";
import type * as refunds from "../refunds.js";
import type * as settings from "../settings.js";
import type * as testing_mercadopagoFake from "../testing/mercadopagoFake.js";
import type * as voucherReconciliation from "../voucherReconciliation.js";
import type * as vouchers from "../vouchers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authAdmin: typeof authAdmin;
  crons: typeof crons;
  finance: typeof finance;
  http: typeof http;
  import: typeof import_;
  "lib/auth": typeof lib_auth;
  "lib/financeSummary": typeof lib_financeSummary;
  "lib/mercadopago": typeof lib_mercadopago;
  "lib/mercadopagoError": typeof lib_mercadopagoError;
  "lib/mercadopagoOperations": typeof lib_mercadopagoOperations;
  "lib/paymentOperation": typeof lib_paymentOperation;
  "lib/paymentReversal": typeof lib_paymentReversal;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/refundFailure": typeof lib_refundFailure;
  "lib/serviceAuth": typeof lib_serviceAuth;
  "lib/settings": typeof lib_settings;
  "lib/siteUrl": typeof lib_siteUrl;
  "lib/voucherCode": typeof lib_voucherCode;
  "lib/voucherPurchase": typeof lib_voucherPurchase;
  "lib/voucherReschedule": typeof lib_voucherReschedule;
  "lib/voucherSearch": typeof lib_voucherSearch;
  "lib/voucherWrites": typeof lib_voucherWrites;
  maintenance: typeof maintenance;
  mercadopago: typeof mercadopago;
  migrations: typeof migrations;
  paymentOperations: typeof paymentOperations;
  paymentSync: typeof paymentSync;
  refunds: typeof refunds;
  settings: typeof settings;
  "testing/mercadopagoFake": typeof testing_mercadopagoFake;
  voucherReconciliation: typeof voucherReconciliation;
  vouchers: typeof vouchers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
