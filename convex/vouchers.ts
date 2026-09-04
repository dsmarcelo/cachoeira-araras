import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

/**
 * Whether a voucher counts as a real, live voucher for operational and
 * reporting purposes: not soft-deleted, and not a Test Voucher. Every gate,
 * admin, and summary query must use this instead of re-typing the two
 * conditions, so a new query can't accidentally forget one.
 */
export function countsAsRealVoucher(
  voucher: Pick<Doc<"vouchers">, "deletedAt" | "isTest">,
): boolean {
  return voucher.deletedAt === undefined && !voucher.isTest;
}

/**
 * Public status lookup by Voucher Code: the one path a visitor can hit with
 * no session, so it deliberately does NOT filter out Test Vouchers the way
 * `countsAsRealVoucher` does — a tester needs to see their own voucher's real
 * state to exercise the full purchase-to-entry path. It still hides
 * soft-deleted vouchers, and returns only the fields a stranger holding a
 * guessed code may see: no name, phone, price, or Mercado Pago identifiers.
 */
export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      code: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("valid"),
        v.literal("redeemed"),
        v.literal("expired"),
      ),
      visitDate: v.string(),
      expiresAt: v.number(),
      adults: v.number(),
      elderly: v.number(),
      adultsPool: v.number(),
      elderlyPool: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      return null;
    }

    return {
      code: voucher.code,
      status: voucher.status,
      visitDate: voucher.visitDate,
      expiresAt: voucher.expiresAt,
      adults: voucher.adults,
      elderly: voucher.elderly,
      adultsPool: voucher.adultsPool,
      elderlyPool: voucher.elderlyPool,
    };
  },
});
