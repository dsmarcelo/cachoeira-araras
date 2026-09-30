import { ConvexError } from "convex/values";

import { endOfSaoPauloDayMs, getSaoPauloDateKey } from "../../src/lib/utils/date";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { getRole } from "./auth";
import {
  formatRetryAfter,
  MAX_PENDING_VOUCHERS_PER_PHONE,
  rateLimiter,
} from "./rateLimiter";
import type { SettingValueMap } from "./settings";
import { classifyReferrer, splitCustomerName } from "./voucherCode";
import { validateVoucherPurchase } from "./voucherPurchase";

export function buildReferrer(
  referrerUrl: string | null | undefined,
): { source: string; url: string } | undefined {
  const normalized = referrerUrl?.trim();
  if (!normalized) {
    return undefined;
  }
  return { source: classifyReferrer(normalized), url: normalized };
}

type IntakeArgs = {
  name: string;
  phone: string;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  visitDateMs: number;
  testMode?: boolean;
  referrerUrl?: string | null;
};

/**
 * Server-owned rules shared by every way of starting a purchase (Checkout Pro
 * and the embedded Bricks flow): role-gated test pricing, quantity and Visit
 * Date validation, authoritative price, the pending-voucher ceiling per phone
 * and rate limits. Throws readable ConvexErrors; returns the values the
 * caller persists on the Pending Voucher.
 */
export async function prepareVoucherIntake(ctx: ActionCtx, args: IntakeArgs) {
  const role = await getRole(ctx);
  const canUseTestMode = role === "admin" || role === "employee";

  const settings: SettingValueMap = await ctx.runQuery(api.settings.getAll, {});
  const visitDate = getSaoPauloDateKey(new Date(args.visitDateMs));

  const { priceCents } = validateVoucherPurchase(
    {
      adults: args.adults,
      elderly: args.elderly,
      adultsPool: args.adultsPool,
      elderlyPool: args.elderlyPool,
      visitDate,
      testMode: args.testMode,
    },
    { canUseTestMode, settings },
  );

  // Ceiling on unexpired Pending Vouchers per phone, checked before any
  // rate-limit token is spent: an abandoned pending checkout should send
  // the customer back to finish that one, not toward "wait and retry".
  const pendingCount: number = await ctx.runQuery(
    internal.vouchers.countUnexpiredPendingByPhone,
    { phone: args.phone, now: Date.now() },
  );
  if (pendingCount >= MAX_PENDING_VOUCHERS_PER_PHONE) {
    throw new ConvexError(pendingPurchaseMessage);
  }

  const phoneRateLimit = await rateLimiter.limit(ctx, "checkoutByPhone", {
    key: args.phone,
  });
  if (!phoneRateLimit.ok) {
    throw new ConvexError(
      `Muitas tentativas de compra com este telefone. Aguarde ${formatRetryAfter(phoneRateLimit.retryAfter ?? 0)} e tente novamente.`,
    );
  }

  const globalRateLimit = await rateLimiter.limit(ctx, "checkoutGlobal");
  if (!globalRateLimit.ok) {
    throw new ConvexError(
      `O sistema está processando muitas compras no momento. Aguarde ${formatRetryAfter(globalRateLimit.retryAfter ?? 0)} e tente novamente.`,
    );
  }

  return {
    priceCents,
    visitDate,
    expiresAt: endOfSaoPauloDayMs(visitDate),
    isTest: args.testMode === true,
    referrer: buildReferrer(args.referrerUrl),
    ...splitCustomerName(args.name),
  };
}

export const pendingPurchaseMessage =
  "Você já tem uma compra pendente com este telefone. Finalize o pagamento pendente (verifique o código enviado anteriormente) antes de iniciar uma nova compra.";
