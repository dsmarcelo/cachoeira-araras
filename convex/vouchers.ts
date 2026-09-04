import { v } from "convex/values";

import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getRole, requireRole } from "./lib/auth";
import { createCheckoutPreference } from "./lib/mercadopago";
import type { SettingValueMap } from "./lib/settings";
import {
  classifyReferrer,
  formatVoucherCheckoutDescription,
  generateVoucherCode,
  splitCustomerName,
} from "./lib/voucherCode";
import { validateVoucherPurchase } from "./lib/voucherPurchase";

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

const maxVoucherCodeAttempts = 10;

const referrerValidator = v.object({ source: v.string(), url: v.string() });

/**
 * A visit date is one Sao Paulo calendar day, end to end: the voucher stops
 * being redeemable at the end of the day the customer chose. Sao Paulo has
 * used a fixed UTC-3 offset since Brazil abolished daylight saving in 2019,
 * matching the same fixed-offset assumption already made elsewhere in this
 * codebase (see the month-range helper in the Mercado Pago admin router).
 */
function endOfSaoPauloDayMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, day, 3, 0, 0, 0) + 24 * 60 * 60 * 1000 - 1;
}

function buildReferrer(
  referrerUrl: string | null | undefined,
): { source: string; url: string } | undefined {
  const normalized = referrerUrl?.trim();
  if (!normalized) {
    return undefined;
  }
  return { source: classifyReferrer(normalized), url: normalized };
}

/**
 * A voucher purchase: derive the price from current Site Settings (never
 * from client input), generate a short unique code, create the Mercado Pago
 * checkout preference, then hand off to `insertPendingVoucher` — which
 * re-checks code uniqueness and inserts in one transaction. A collision
 * there (two concurrent checkouts landing on the same code) retries this
 * whole loop with a fresh code and a fresh preference, rather than erroring
 * out on the loser.
 */
export const startCheckout = action({
  args: {
    name: v.string(),
    phone: v.string(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
    // The visitor's chosen visit date, as a client timestamp (ms). Converted
    // to a Sao Paulo calendar date server-side via getSaoPauloDateKey, the
    // one place that conversion happens.
    visitDateMs: v.number(),
    testMode: v.optional(v.boolean()),
    referrerUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    code: v.string(),
    preferenceId: v.string(),
    initPoint: v.string(),
    priceCents: v.number(),
  }),
  handler: async (ctx, args) => {
    const role = await getRole(ctx);
    const canUseTestMode = role === "admin" || role === "employee";

    const settings: SettingValueMap = await ctx.runQuery(
      api.settings.getAll,
      {},
    );
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

    const activeVoucher: { code: string } | null = await ctx.runQuery(
      internal.vouchers.findActiveByPhone,
      { phone: args.phone },
    );
    if (activeVoucher) {
      throw new Error(
        `Você já possui um voucher válido (código ${activeVoucher.code}) cadastrado com este telefone. Anote o código antes de comprar outro e certifique-se de que realmente precisa adquirir um novo voucher.`,
      );
    }

    const { firstName, surname } = splitCustomerName(args.name);
    const referrer = buildReferrer(args.referrerUrl);
    const isTest = args.testMode === true;
    const expiresAt = endOfSaoPauloDayMs(visitDate);

    for (let attempt = 1; attempt <= maxVoucherCodeAttempts; attempt += 1) {
      const code = generateVoucherCode();

      const preference = await createCheckoutPreference({
        code,
        description: formatVoucherCheckoutDescription({
          adults: args.adults,
          elderly: args.elderly,
          adultsPool: args.adultsPool,
          elderlyPool: args.elderlyPool,
          phone: args.phone,
          code,
        }),
        priceCents,
        name: firstName,
        surname,
        phone: args.phone,
      });

      const result: { ok: boolean } = await ctx.runMutation(
        internal.vouchers.insertPendingVoucher,
        {
          code,
          name: args.name,
          phone: args.phone,
          adults: args.adults,
          elderly: args.elderly,
          adultsPool: args.adultsPool,
          elderlyPool: args.elderlyPool,
          priceCents,
          visitDate,
          expiresAt,
          preferenceId: preference.id,
          referrer,
          isTest,
        },
      );

      if (result.ok) {
        return {
          code,
          preferenceId: preference.id,
          initPoint: preference.initPoint,
          priceCents,
        };
      }
      // Code collision: retry with a fresh code and a fresh preference
      // rather than surfacing an error to the loser.
    }

    throw new Error(
      "Não foi possível gerar um código de voucher disponível.",
    );
  },
});

/**
 * Whether `phone` already holds a valid voucher, so checkout can refuse a
 * second purchase. Scoped by the `by_phone` index; a given phone number
 * accrues at most a handful of vouchers, so collecting them is bounded.
 */
export const findActiveByPhone = internalQuery({
  args: { phone: v.string() },
  returns: v.union(v.object({ code: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const vouchers = await ctx.db
      .query("vouchers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    const active = vouchers.find(
      (voucher) => voucher.status === "valid" && voucher.deletedAt === undefined,
    );

    return active ? { code: active.code } : null;
  },
});

/**
 * Re-checks code uniqueness and inserts the Pending voucher in one
 * transaction, closing the time-of-check/time-of-use race where the two
 * used to be separate calls. Returns `{ ok: false }` on a collision instead
 * of throwing, so `startCheckout` can retry with a new code.
 */
export const insertPendingVoucher = internalMutation({
  args: {
    code: v.string(),
    name: v.string(),
    phone: v.string(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
    priceCents: v.number(),
    visitDate: v.string(),
    expiresAt: v.number(),
    preferenceId: v.string(),
    referrer: v.optional(referrerValidator),
    isTest: v.boolean(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false) }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      return { ok: false };
    }

    await ctx.db.insert("vouchers", {
      code: args.code,
      name: args.name,
      phone: args.phone,
      adults: args.adults,
      elderly: args.elderly,
      adultsPool: args.adultsPool,
      elderlyPool: args.elderlyPool,
      priceCents: args.priceCents,
      status: "pending",
      visitDate: args.visitDate,
      expiresAt: args.expiresAt,
      preferenceId: args.preferenceId,
      referrer: args.referrer,
      isTest: args.isTest,
    });

    return { ok: true };
  },
});

/** The subset of a voucher a payment confirmation caller needs: the WhatsApp
 * message it sends and the conversion event it may fire both read from this,
 * never the raw document. */
const paymentConfirmationVoucherValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  priceCents: v.number(),
  visitDate: v.string(),
  expiresAt: v.number(),
});

function summarizeForPaymentConfirmation(voucher: Doc<"vouchers">) {
  return {
    code: voucher.code,
    name: voucher.name,
    phone: voucher.phone,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adultsPool,
    elderlyPool: voucher.elderlyPool,
    priceCents: voucher.priceCents,
    visitDate: voucher.visitDate,
    expiresAt: voucher.expiresAt,
  };
}

/**
 * Confirms a Mercado Pago payment against the voucher it paid for. Called
 * only from the Mercado Pago webhook route (a thin Next.js adapter that has
 * already verified MP's HMAC signature before minting itself an admin
 * identity token — see src/server/convex-service.ts), never from a browser.
 *
 * Idempotent: a repeated delivery for a voucher already `valid` or
 * `redeemed` changes nothing and reports `becameValid: false`, so the caller
 * sends no second WhatsApp message and fires no second conversion event. A
 * `redeemed` voucher is never reverted, regardless of `paymentStatus`.
 */
export const confirmPayment = mutation({
  args: {
    code: v.string(),
    paymentId: v.string(),
    paymentStatus: v.union(v.string(), v.null()),
  },
  returns: v.union(
    v.object({
      outcome: v.union(
        v.literal("redeemed"),
        v.literal("already_processed"),
        v.literal("updated"),
      ),
      becameValid: v.boolean(),
      isTest: v.boolean(),
      voucher: paymentConfirmationVoucherValidator,
    }),
    v.object({ outcome: v.literal("not_found") }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher) {
      return { outcome: "not_found" as const };
    }

    if (voucher.status === "redeemed") {
      return {
        outcome: "redeemed" as const,
        becameValid: false,
        isTest: voucher.isTest,
        voucher: summarizeForPaymentConfirmation(voucher),
      };
    }

    if (voucher.status === "valid") {
      return {
        outcome: "already_processed" as const,
        becameValid: false,
        isTest: voucher.isTest,
        voucher: summarizeForPaymentConfirmation(voucher),
      };
    }

    if (args.paymentStatus !== "approved") {
      // Record the payment id so it's correlated even though the voucher
      // isn't confirmed valid yet; no conversion event, no WhatsApp message.
      await ctx.db.patch(voucher._id, { paymentId: args.paymentId });
      return {
        outcome: "updated" as const,
        becameValid: false,
        isTest: voucher.isTest,
        voucher: summarizeForPaymentConfirmation(voucher),
      };
    }

    await ctx.db.patch(voucher._id, {
      status: "valid",
      paymentId: args.paymentId,
    });

    return {
      outcome: "updated" as const,
      becameValid: true,
      isTest: voucher.isTest,
      voucher: summarizeForPaymentConfirmation({
        ...voucher,
        status: "valid",
        paymentId: args.paymentId,
      }),
    };
  },
});
