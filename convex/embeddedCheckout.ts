import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { generateVoucherCode } from "./lib/voucherCode";
import { pendingPurchaseMessage, prepareVoucherIntake } from "./lib/voucherIntake";

const maxVoucherCodeAttempts = 10;

type InsertPendingVoucherResult =
  | { ok: true; managementToken: string }
  | { ok: false; reason: "code_collision" | "pending_conflict" };

/**
 * Starts every new purchase: server-owned rules (price, quantities, Visit
 * Date, phone ceiling, rate limits) and no Mercado Pago preference. Payment is requested later, through
 * a Payment Attempt on the Voucher this creates. The returned
 * `managementToken` is the browser's only capability to pay, resume or cancel.
 */
export const startPurchase = action({
  args: {
    name: v.string(),
    phone: v.string(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
    visitDateMs: v.number(),
    testMode: v.optional(v.boolean()),
    referrerUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    code: v.string(),
    priceCents: v.number(),
    managementToken: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ code: string; priceCents: number; managementToken: string }> => {
    const { priceCents, visitDate, expiresAt, isTest, referrer } =
      await prepareVoucherIntake(ctx, args);

    for (let attempt = 1; attempt <= maxVoucherCodeAttempts; attempt += 1) {
      const code = generateVoucherCode();
      const result: InsertPendingVoucherResult = await ctx.runMutation(
        internal.vouchers.insertPendingVoucher,
        {
          code,
          managementToken: crypto.randomUUID(),
          name: args.name,
          phone: args.phone,
          adults: args.adults,
          elderly: args.elderly,
          adultsPool: args.adultsPool,
          elderlyPool: args.elderlyPool,
          priceCents,
          visitDate,
          expiresAt,
          referrer,
          isTest,
        },
      );

      if (result.ok) {
        return { code, priceCents, managementToken: result.managementToken };
      }
      if (result.reason === "pending_conflict") {
        throw new ConvexError(pendingPurchaseMessage);
      }
      // Code collision: try again with a fresh code.
    }

    throw new ConvexError(
      "Não foi possível gerar um código de voucher disponível.",
    );
  },
});
