import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A Voucher Code is the identity of a voucher; there is no separate surrogate
// id. `status` is the single source of truth for voucher state (no parallel
// boolean). `visitDate` is the day the customer chose at purchase and is
// never written by staff; `expiresAt` is when the voucher stops being
// redeemable and is the only field a reactivation may move.
const vouchers = defineTable({
  code: v.string(),
  name: v.string(),
  phone: v.string(),

  adults: v.number(),
  elderly: v.number(),
  adultsPool: v.number(),
  elderlyPool: v.number(),

  // Integer cents. Conversion to decimal reais happens only at display and
  // at the Mercado Pago `unit_price` boundary.
  priceCents: v.number(),

  // `refunded` covers any negative-terminal Mercado Pago notification
  // (refund, chargeback, or cancellation) that arrives for a Voucher that
  // was never redeemed: it is a dead end like `expired`, never redeemable,
  // and never reverts to `valid`.
  status: v.union(
    v.literal("pending"),
    v.literal("valid"),
    v.literal("redeemed"),
    v.literal("expired"),
    v.literal("refunded"),
  ),

  // The day the customer chose at purchase, as "YYYY-MM-DD" in the Sao Paulo
  // calendar. Never rewritten by staff, including on reactivation.
  visitDate: v.string(),
  // When the voucher stops being redeemable. Reactivation moves this field,
  // never `visitDate`.
  expiresAt: v.number(),

  // Mercado Pago identifiers, needed to correlate checkout and webhook
  // delivery and to make payment confirmation idempotent.
  preferenceId: v.string(),
  paymentId: v.optional(v.string()),

  // Set once, the first time a negative-terminal Mercado Pago notification
  // (refund, chargeback, cancellation) arrives after the Voucher was already
  // `valid` or `redeemed`. `reason` is the raw Mercado Pago payment status.
  // Present alongside `status: "redeemed"`, this is the administrative
  // warning staff see: the entry already happened and is never undone, but
  // the payment behind it was reversed afterwards.
  reversal: v.optional(
    v.object({
      reason: v.string(),
      notedAt: v.number(),
    }),
  ),

  // Replaces the separate 1:1 Referrer table.
  referrer: v.optional(
    v.object({
      source: v.string(),
      url: v.string(),
    }),
  ),

  // Server-set from the same authorisation check that permits test-mode
  // pricing; never accepted from client input.
  isTest: v.boolean(),

  deletedAt: v.optional(v.number()),
})
  .index("by_code", ["code"])
  .index("by_paymentId", ["paymentId"])
  .index("by_phone", ["phone"])
  .index("by_visitDate", ["visitDate"]);

// One document per key so concurrent admins editing settings cannot clobber
// each other. `key` values and their value shapes come from the
// SettingKey/SettingValueMap map in src/lib/settings.ts, which stays the
// compile-time source of truth; this validator only bounds the shapes the
// settings vocabulary actually uses. `updatedBy`/`updatedAt` are set only by
// `settings.set`, from the caller's verified identity and the server clock,
// so a surprising value can be traced to who changed it and when.
const settings = defineTable({
  key: v.string(),
  value: v.union(
    v.number(),
    v.string(),
    v.boolean(),
    v.array(v.string()),
  ),
  updatedBy: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
}).index("by_key", ["key"]);

export default defineSchema({
  vouchers,
  settings,
});
