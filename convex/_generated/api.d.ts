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
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_mercadopago from "../lib/mercadopago.js";
import type * as lib_serviceAuth from "../lib/serviceAuth.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_voucherCode from "../lib/voucherCode.js";
import type * as lib_voucherPurchase from "../lib/voucherPurchase.js";
import type * as maintenance from "../maintenance.js";
import type * as mercadopago from "../mercadopago.js";
import type * as settings from "../settings.js";
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
  http: typeof http;
  import: typeof import_;
  "lib/auth": typeof lib_auth;
  "lib/mercadopago": typeof lib_mercadopago;
  "lib/serviceAuth": typeof lib_serviceAuth;
  "lib/settings": typeof lib_settings;
  "lib/voucherCode": typeof lib_voucherCode;
  "lib/voucherPurchase": typeof lib_voucherPurchase;
  maintenance: typeof maintenance;
  mercadopago: typeof mercadopago;
  settings: typeof settings;
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
};
