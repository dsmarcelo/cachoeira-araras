/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { createConvexTest, withAuth } from "./test.setup";

const today = getSaoPauloDateKey();

function voucherDoc(overrides: Record<string, unknown> = {}) {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "pending" as
      | "pending"
      | "valid"
      | "redeemed"
      | "expired"
      | "refunded"
      | "cancelled",
    visitDate: today,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
    purchasedAt: Date.now(),
    ...overrides,
  };
}

/** Runs the recomputes that voucher writes scheduled. */
async function settle(t: ReturnType<typeof createConvexTest>) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

async function todaySummary(t: ReturnType<typeof createConvexTest>) {
  return t.run((ctx) =>
    ctx.db
      .query("financeDays")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique(),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

test("confirming a payment adds the voucher to today's summary", async () => {
  const t = createConvexTest();
  await t.run((ctx) => ctx.db.insert("vouchers", voucherDoc()));

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
    paymentTypeId: "bank_transfer",
    paymentMethodId: "pix",
  });
  await settle(t);

  expect(await todaySummary(t)).toMatchObject({
    netCents: 5000,
    voucherCount: 1,
    paymentMethods: [{ key: "pix", netCents: 5000, voucherCount: 1 }],
  });
});

test("a reversal after confirmation takes the voucher back out of the summary", async () => {
  const t = createConvexTest();
  await t.run((ctx) => ctx.db.insert("vouchers", voucherDoc()));
  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "approved",
  });
  await settle(t);
  expect(await todaySummary(t)).not.toBeNull();

  await t.mutation(internal.vouchers.confirmPayment, {
    code: "a1b2",
    paymentId: "pay-1",
    paymentStatus: "charged_back",
  });
  await settle(t);

  // A day without revenue has no document.
  expect(await todaySummary(t)).toBeNull();
});

test("completing a refund removes the voucher from the summary", async () => {
  const t = createConvexTest();
  const refundId = await t.run(async (ctx) => {
    await ctx.db.insert(
      "vouchers",
      voucherDoc({ status: "valid", paymentId: "pay-1" }),
    );
    return ctx.db.insert("paymentRefunds", {
      paymentId: "pay-1",
      voucherCode: "a1b2",
      amountCents: 5000,
      status: "processing",
      attemptCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await t.mutation(internal.finance.recomputeDay, { date: today });
  expect(await todaySummary(t)).toMatchObject({ voucherCount: 1 });

  await t.mutation(internal.refunds.markCompleted, { id: refundId });
  await settle(t);

  expect(await todaySummary(t)).toBeNull();
});

test("staff status changes, restore and reactivate keep the summary in step", async () => {
  const t = createConvexTest();
  await t.run((ctx) =>
    ctx.db.insert("vouchers", voucherDoc({ status: "valid", paymentId: "pay-1" })),
  );
  await t.mutation(internal.finance.recomputeDay, { date: today });
  const asAdmin = await withAuth(t, "admin");

  await asAdmin.mutation(api.vouchers.updateStatus, { code: "a1b2", status: "refunded" });
  await settle(t);
  expect(await todaySummary(t)).toBeNull();

  await asAdmin.mutation(api.vouchers.reactivate, { code: "a1b2" });
  await settle(t);
  expect(await todaySummary(t)).toMatchObject({ voucherCount: 1 });

  // Soft-deleted vouchers do not count; restoring brings them back.
  await t.run(async (ctx) => {
    const voucher = await ctx.db.query("vouchers").first();
    await ctx.db.patch(voucher!._id, { deletedAt: Date.now(), isActive: false });
  });
  await t.mutation(internal.finance.recomputeDay, { date: today });
  expect(await todaySummary(t)).toBeNull();

  await asAdmin.mutation(api.vouchers.restore, { code: "a1b2" });
  await settle(t);
  expect(await todaySummary(t)).toMatchObject({ voucherCount: 1 });
});

test("rebuildAll walks every day from the earliest purchase to today and drops stale summaries", async () => {
  const t = createConvexTest();
  const dayMs = 24 * 60 * 60 * 1000;
  await t.run(async (ctx) => {
    // 25 days back: more than one rebuild batch away from today.
    await ctx.db.insert("vouchers", voucherDoc({ code: "old", status: "valid", paymentId: "p1", purchasedAt: Date.now() - 25 * dayMs }));
    await ctx.db.insert("vouchers", voucherDoc({ code: "new", status: "valid", paymentId: "p2" }));
    // A summary with no vouchers behind it.
    await ctx.db.insert("financeDays", {
      date: today, netCents: 999, voucherCount: 9, hours: [], referrers: [], paymentMethods: [], updatedAt: 0,
    });
  });

  vi.useFakeTimers();
  try {
    await t.mutation(internal.finance.rebuildAll, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }

  const days = await t.run((ctx) => ctx.db.query("financeDays").collect());
  expect(days).toHaveLength(2);
  expect(days.every((d) => d.netCents === 5000 && d.voucherCount === 1)).toBe(true);
  expect(days.some((d) => d.date === today)).toBe(true);
});
