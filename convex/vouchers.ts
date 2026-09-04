import { v } from "convex/values";

import {
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
  startOfSaoPauloDayMs,
} from "../src/lib/utils/date";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
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

export const referrerValidator = v.object({
  source: v.string(),
  url: v.string(),
});

export const voucherStatusValidator = v.union(
  v.literal("pending"),
  v.literal("valid"),
  v.literal("redeemed"),
  v.literal("expired"),
);

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
 * Resolves voucher records for a set of Mercado Pago payments by code
 * (externalReference) or paymentId. Used by the Mercado Pago admin action to
 * enrich payments with voucher data from Convex without Prisma.
 */
export const findForPaymentEnrichment = internalQuery({
  args: {
    codes: v.array(v.string()),
    paymentIds: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      code: v.string(),
      name: v.string(),
      phone: v.string(),
      paymentId: v.union(v.string(), v.null()),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const vouchers: Array<{
      code: string;
      name: string;
      phone: string;
      paymentId: string | null;
      status: string;
    }> = [];

    const seenCodes = new Set<string>();

    for (const code of args.codes) {
      if (!code) continue;
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (voucher && voucher.deletedAt === undefined) {
        seenCodes.add(voucher.code);
        vouchers.push({
          code: voucher.code,
          name: voucher.name,
          phone: voucher.phone,
          paymentId: voucher.paymentId ?? null,
          status: voucher.status,
        });
      }
    }

    for (const paymentId of args.paymentIds) {
      if (!paymentId) continue;
      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
        .unique();

      if (
        voucher &&
        voucher.deletedAt === undefined &&
        !seenCodes.has(voucher.code)
      ) {
        seenCodes.add(voucher.code);
        vouchers.push({
          code: voucher.code,
          name: voucher.name,
          phone: voucher.phone,
          paymentId: voucher.paymentId ?? null,
          status: voucher.status,
        });
      }
    }

    return vouchers;
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
 * Confirms a Mercado Pago payment against the voucher it paid for. Internal
 * only — the sole caller is the `/webhooks/mercadopago/confirmPayment` HTTP
 * action (convex/http.ts), reached from the Mercado Pago webhook route (a
 * thin Next.js adapter that has already verified MP's HMAC signature) over a
 * shared-secret door, never a Convex identity. There is deliberately no
 * public `mutation` wrapping this: a signed-in admin session has no path to
 * it at all.
 *
 * Idempotent: a repeated delivery for a voucher already `valid` or
 * `redeemed` changes nothing and reports `becameValid: false`, so the caller
 * sends no second WhatsApp message and fires no second conversion event. A
 * `redeemed` voucher is never reverted, regardless of `paymentStatus`.
 */
export const confirmPayment = internalMutation({
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

const gateVoucherValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("valid"),
    v.literal("redeemed"),
    v.literal("expired"),
  ),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  visitDate: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
});

function summarizeForGate(voucher: Doc<"vouchers">) {
  return {
    code: voucher.code,
    name: voucher.name,
    phone: voucher.phone,
    status: voucher.status,
    adults: voucher.adults,
    elderly: voucher.elderly,
    adultsPool: voucher.adultsPool,
    elderlyPool: voucher.elderlyPool,
    visitDate: voucher.visitDate,
    expiresAt: voucher.expiresAt,
    createdAt: voucher._creationTime,
  };
}

/**
 * Today's real vouchers (excludes Test Vouchers and soft-deleted rows), keyed
 * on `visitDate` in the Sao Paulo calendar so the operational day rolls over
 * at Sao Paulo midnight, not at 21:00 on a UTC server. Shared by both
 * `listToday` and `listTodayAdmin` so the day/index/filter logic lives in one
 * place.
 */
async function todaysRealVouchers(ctx: { db: QueryCtx["db"] }) {
  const today = getSaoPauloDateKey();
  const vouchers = await ctx.db
    .query("vouchers")
    .withIndex("by_visitDate", (q) => q.eq("visitDate", today))
    .collect();

  return vouchers
    .filter(countsAsRealVoucher)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The vouchers gate staff expect to see today. Staff-only (admin or
 * employee): a public caller gets a 401 rather than any data. Test Vouchers
 * are excluded via `countsAsRealVoucher` — they stay redeemable by code
 * (`redeemByCode` below), just absent from this operational view. An
 * ordinary reactive query, so a payment confirmed by the webhook while staff
 * are looking at the screen appears without a refresh.
 *
 * Deliberately PII-minimal: this is the query an employee session can reach.
 * Payment identifiers (`paymentId`, `preferenceId`) and referrer live only in
 * `listTodayAdmin`, which is admin-gated.
 */
export const listToday = query({
  args: {},
  returns: v.array(gateVoucherValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "employee");

    const vouchers = await todaysRealVouchers(ctx);
    return vouchers.map(summarizeForGate);
  },
});

const gateVoucherAdminValidator = v.object({
  code: v.string(),
  name: v.string(),
  phone: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("valid"),
    v.literal("redeemed"),
    v.literal("expired"),
  ),
  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),
  visitDate: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
  paymentId: v.optional(v.string()),
  preferenceId: v.string(),
  referrer: v.optional(referrerValidator),
});

function summarizeForGateAdmin(voucher: Doc<"vouchers">) {
  return {
    ...summarizeForGate(voucher),
    paymentId: voucher.paymentId,
    preferenceId: voucher.preferenceId,
    referrer: voucher.referrer,
  };
}

/**
 * The admin variant of `listToday`: same today/Sao Paulo/Test-Voucher rules,
 * plus the payment identifiers and referrer the admin gate card's "Detalhes
 * do pagamento" section needs. Admin-only — an employee identity is rejected
 * here even though it can read `listToday`, so an employee session has no
 * path to a payment id or preference id.
 */
export const listTodayAdmin = query({
  args: {},
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const vouchers = await todaysRealVouchers(ctx);
    return vouchers.map(summarizeForGateAdmin);
  },
});

/**
 * Redeems a voucher by code at the gate. Staff-only. Refuses (rather than
 * silently no-opping) a voucher that is already `redeemed`, so a second
 * attempt cannot admit the same party twice; refuses anything not currently
 * `valid`; and refuses a voucher whose `visitDate` isn't today in Sao Paulo,
 * so nobody is admitted on the wrong day. Deliberately does not filter Test
 * Vouchers: they must stay redeemable by code so the full purchase-to-entry
 * path can be verified.
 */
export const redeemByCode = mutation({
  args: { code: v.string() },
  returns: v.object({ code: v.string(), status: v.literal("redeemed") }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      throw new Error("Voucher não encontrado.");
    }

    if (voucher.status === "redeemed") {
      throw new Error("Este voucher já foi utilizado.");
    }

    if (voucher.status !== "valid") {
      throw new Error("Este voucher não está disponível para uso.");
    }

    const today = getSaoPauloDateKey();
    if (voucher.visitDate !== today) {
      throw new Error("Este voucher não é válido para o dia de hoje.");
    }

    await ctx.db.patch(voucher._id, { status: "redeemed" });

    return { code: voucher.code, status: "redeemed" as const };
  },
});

/**
 * Reactivates a voucher when a customer has a legitimate reason. Staff-only.
 * Moves only `expiresAt`, extending it to the end of today in Sao Paulo, and
 * sets `status` back to `valid`; `visitDate` — the day the customer
 * originally chose — is never touched, which is the whole point: the old
 * schema conflated the two fields, so reactivating used to silently rewrite
 * the customer's visit date and corrupt reporting.
 */
export const reactivate = mutation({
  args: { code: v.string() },
  returns: v.object({
    code: v.string(),
    status: v.literal("valid"),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "employee");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!voucher || voucher.deletedAt !== undefined) {
      throw new Error("Voucher não encontrado.");
    }

    const expiresAt = endOfSaoPauloDayMs(getSaoPauloDateKey());
    await ctx.db.patch(voucher._id, { status: "valid", expiresAt });

    return { code: voucher.code, status: "valid" as const, expiresAt };
  },
});

/**
 * Every real voucher (excludes Test Vouchers and soft-deleted rows), for the
 * admin table. No cursor pagination and no search index: production holds
 * roughly a thousand vouchers growing at about fifty a month, so the full
 * filtered set is loaded in one reactive query and the browser paginates and
 * substring-searches it — the only way to get true `contains` semantics and
 * an accurate page count at this scale (see the spec's "Admin data access").
 * Status and creation-date-range filters run here so the returned set — and
 * therefore the client's page count — already reflects them; substring
 * search stays client-side since it isn't representable as an index range.
 * Admin-only: an employee identity is rejected, same as `listTodayAdmin`.
 */
export const listAdmin = query({
  args: {
    status: v.optional(voucherStatusValidator),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
  },
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const vouchers = await ctx.db.query("vouchers").collect();

    return vouchers
      .filter(countsAsRealVoucher)
      .filter((voucher) => args.status === undefined || voucher.status === args.status)
      .filter(
        (voucher) =>
          args.createdAfter === undefined ||
          voucher._creationTime >= args.createdAfter,
      )
      .filter(
        (voucher) =>
          args.createdBefore === undefined ||
          voucher._creationTime <= args.createdBefore,
      )
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(summarizeForGateAdmin);
  },
});

/**
 * Soft-deleted vouchers, for the admin's separate audit/restore view — the
 * mirror image of `countsAsRealVoucher`'s `deletedAt` check: everything
 * `listAdmin` hides for being deleted, this shows. Test Vouchers are
 * included here (unlike `listAdmin`) since a soft-deleted Test Voucher is
 * still something an admin may want to audit or restore. Admin-only.
 */
export const listDeleted = query({
  args: {},
  returns: v.array(gateVoucherAdminValidator),
  handler: async (ctx) => {
    await requireRole(ctx, "admin");

    const vouchers = await ctx.db.query("vouchers").collect();

    return vouchers
      .filter((voucher) => voucher.deletedAt !== undefined)
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(summarizeForGateAdmin);
  },
});

/** Looks up a voucher by code or throws, shared by the admin correction mutations below. */
async function requireVoucherByCode(
  ctx: MutationCtx,
  code: string,
): Promise<Doc<"vouchers">> {
  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  if (!voucher) {
    throw new Error("Voucher não encontrado.");
  }
  return voucher;
}

/**
 * Corrects a voucher's status when something needs fixing. Admin-only,
 * unlike `redeemByCode`/`reactivate` which employees can also reach — this
 * is a direct override rather than an operational action, so it stays
 * restricted to the role that can also soft-delete and restore.
 */
export const updateStatus = mutation({
  args: { code: v.string(), status: voucherStatusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    await ctx.db.patch(voucher._id, { status: args.status });
    return null;
  },
});

/**
 * Soft-deletes a voucher: reversible, and removes it from `listAdmin` (via
 * `countsAsRealVoucher`) while keeping it visible in `listDeleted`.
 * Admin-only.
 */
export const softDelete = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    await ctx.db.patch(voucher._id, { deletedAt: Date.now() });
    return null;
  },
});

/** Restores a soft-deleted voucher back into `listAdmin`. Admin-only. */
export const restore = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const voucher = await requireVoucherByCode(ctx, args.code);
    // Convex `patch` removes a field entirely when set to `undefined`.
    await ctx.db.patch(voucher._id, { deletedAt: undefined });
    return null;
  },
});

// --- Admin summaries and daily sales ---
//
// These two queries always read every voucher and reduce in memory (see the
// spec's "Admin data access" section), so they never accept an unbounded
// range: both bounds omitted defaults to the current calendar month in Sao
// Paulo, but supplying only one bound or explicitly passing `null` for both
// is refused rather than scanning the whole table.

/** The first and last day (as date keys) of the current calendar month in Sao Paulo. */
function currentSaoPauloMonthRange(): { fromKey: string; toKey: string } {
  const today = getSaoPauloDateKey();
  const [year, month] = today.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    fromKey: `${year}-${pad(month)}-01`,
    toKey: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Resolves the two optional date-key bounds a summary query receives into a
 * concrete `[fromKey, toKey]` range: both omitted defaults to the current
 * Sao Paulo month, exactly one supplied is refused (an accidental partial
 * bound), and an explicit `null` on either side — a caller asking for an
 * unbounded range on purpose — is refused too.
 */
function resolveDateRange(args: {
  from?: string | null;
  to?: string | null;
}): { fromKey: string; toKey: string } {
  const { from, to } = args;

  if (from === undefined && to === undefined) {
    return currentSaoPauloMonthRange();
  }

  if (from === undefined || to === undefined) {
    throw new Error(
      "A summary range needs both a start and an end date; provide both or neither.",
    );
  }

  if (from === null || to === null) {
    throw new Error(
      "An unbounded date range isn't allowed here: these queries read every matching voucher.",
    );
  }

  if (from > to) {
    throw new Error("The start date must not be after the end date.");
  }

  return { fromKey: from, toKey: to };
}

/**
 * Whether a voucher counts toward "vouchers sold" in the admin summaries: a
 * real voucher (see `countsAsRealVoucher`) whose payment has been confirmed
 * at least once. A still-`pending` voucher hasn't been sold yet, so it
 * contributes to no summary figure.
 */
function countsAsSoldVoucher(voucher: Doc<"vouchers">): boolean {
  return countsAsRealVoucher(voucher) && voucher.status !== "pending";
}

/** Every sold voucher (see `countsAsSoldVoucher`) created within `[fromKey, toKey]`, inclusive, Sao Paulo calendar days. */
async function soldVouchersInRange(
  ctx: { db: QueryCtx["db"] },
  fromKey: string,
  toKey: string,
): Promise<Doc<"vouchers">[]> {
  const fromMs = startOfSaoPauloDayMs(fromKey);
  const toMs = endOfSaoPauloDayMs(toKey);

  const vouchers = await ctx.db.query("vouchers").collect();

  return vouchers.filter(
    (voucher) =>
      countsAsSoldVoucher(voucher) &&
      voucher._creationTime >= fromMs &&
      voucher._creationTime <= toMs,
  );
}

const dateRangeArgs = {
  from: v.optional(v.union(v.string(), v.null())),
  to: v.optional(v.union(v.string(), v.null())),
};

/**
 * Vouchers sold, visitors expected, and revenue (integer cents) for a
 * bounded date range. Admin-only. See `resolveDateRange` for how the range
 * is derived from `from`/`to`, and `countsAsSoldVoucher` for which vouchers
 * count.
 */
export const periodSummary = query({
  args: dateRangeArgs,
  returns: v.object({
    from: v.string(),
    to: v.string(),
    voucherCount: v.number(),
    visitorCount: v.number(),
    revenueCents: v.number(),
    adults: v.number(),
    elderly: v.number(),
    adultsPool: v.number(),
    elderlyPool: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const { fromKey, toKey } = resolveDateRange(args);
    const vouchers = await soldVouchersInRange(ctx, fromKey, toKey);

    const totals = vouchers.reduce(
      (acc, voucher) => {
        acc.revenueCents += voucher.priceCents;
        acc.adults += voucher.adults;
        acc.elderly += voucher.elderly;
        acc.adultsPool += voucher.adultsPool;
        acc.elderlyPool += voucher.elderlyPool;
        return acc;
      },
      { revenueCents: 0, adults: 0, elderly: 0, adultsPool: 0, elderlyPool: 0 },
    );

    return {
      from: fromKey,
      to: toKey,
      voucherCount: vouchers.length,
      visitorCount:
        totals.adults + totals.elderly + totals.adultsPool + totals.elderlyPool,
      ...totals,
    };
  },
});

/**
 * The same range as `periodSummary`, broken down by Sao Paulo calendar day
 * so trends are visible. Only days with at least one sold voucher appear.
 * Admin-only.
 */
export const dailyBreakdown = query({
  args: dateRangeArgs,
  returns: v.array(
    v.object({
      date: v.string(),
      voucherCount: v.number(),
      visitorCount: v.number(),
      revenueCents: v.number(),
      adults: v.number(),
      elderly: v.number(),
      adultsPool: v.number(),
      elderlyPool: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const { fromKey, toKey } = resolveDateRange(args);
    const vouchers = await soldVouchersInRange(ctx, fromKey, toKey);

    const byDay = new Map<
      string,
      {
        voucherCount: number;
        revenueCents: number;
        adults: number;
        elderly: number;
        adultsPool: number;
        elderlyPool: number;
      }
    >();

    for (const voucher of vouchers) {
      const day = getSaoPauloDateKey(new Date(voucher._creationTime));
      const bucket = byDay.get(day) ?? {
        voucherCount: 0,
        revenueCents: 0,
        adults: 0,
        elderly: 0,
        adultsPool: 0,
        elderlyPool: 0,
      };
      bucket.voucherCount += 1;
      bucket.revenueCents += voucher.priceCents;
      bucket.adults += voucher.adults;
      bucket.elderly += voucher.elderly;
      bucket.adultsPool += voucher.adultsPool;
      bucket.elderlyPool += voucher.elderlyPool;
      byDay.set(day, bucket);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({
        date,
        ...bucket,
        visitorCount:
          bucket.adults + bucket.elderly + bucket.adultsPool + bucket.elderlyPool,
      }));
  },
});
