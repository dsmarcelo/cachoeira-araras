/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as "pending" | "valid" | "redeemed" | "expired",
    visitDate: "2026-01-05",
    expiresAt: Date.UTC(2026, 0, 5, 3, 0, 0) - 1 + 24 * 60 * 60 * 1000,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
  };
}

/**
 * Inserts a voucher whose `_creationTime` is exactly `atMs`, by faking the
 * system clock convex-test's backend stamps documents with. Callers must
 * insert in non-decreasing `atMs` order within a test: convex-test ratchets
 * `_creationTime` forward when the clock doesn't advance, so an
 * out-of-order call wouldn't land on the requested day.
 */
async function insertVoucherAt(
  t: ReturnType<typeof convexTest>,
  atMs: number,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  vi.useFakeTimers();
  vi.setSystemTime(atMs);
  try {
    const voucher = { ...defaults(), ...overrides };
    await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
    return voucher;
  } finally {
    vi.useRealTimers();
  }
}

/** Midday UTC on the given Sao Paulo calendar date, safely clear of the day's 03:00 UTC boundaries. */
function middayMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, day, 12, 0, 0);
}

afterEach(() => {
  vi.useRealTimers();
});

test("a bounded range returns voucher count, visitor count and revenue for that period, excluding a still-pending voucher", async () => {
  const t = convexTest(schema, modules);
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "in-1",
    status: "valid",
    priceCents: 5000,
    adults: 2,
    elderly: 1,
  });
  await insertVoucherAt(t, middayMs("2026-01-06"), {
    code: "in-2",
    status: "redeemed",
    priceCents: 3000,
    adults: 1,
    elderly: 0,
    adultsPool: 1,
  });
  // Unpaid: hasn't been sold yet, so it must not appear in any figure.
  await insertVoucherAt(t, middayMs("2026-01-06"), {
    code: "unpaid",
    status: "pending",
    priceCents: 9999,
    adults: 4,
  });
  // Outside the requested range entirely.
  await insertVoucherAt(t, middayMs("2026-02-01"), {
    code: "out-of-range",
    status: "valid",
    priceCents: 7000,
  });

  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  const summary = await asAdmin.query(api.vouchers.periodSummary, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  expect(summary.voucherCount).toBe(2);
  expect(summary.revenueCents).toBe(8000);
  expect(summary.visitorCount).toBe(5); // 2+1 + 1+0+1
  expect(summary.adults).toBe(3);
  expect(summary.elderly).toBe(1);
  expect(summary.adultsPool).toBe(1);
});

test("with both bounds omitted, the current calendar month in Sao Paulo is used", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(middayMs("2026-03-15"));
  try {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) =>
      ctx.db.insert("vouchers", { ...defaults(), code: "march" }),
    );
    const asAdmin = t.withIdentity({ "properties.role": "admin" });

    const summary = await asAdmin.query(api.vouchers.periodSummary, {});

    expect(summary.from).toBe("2026-03-01");
    expect(summary.to).toBe("2026-03-31");
    expect(summary.voucherCount).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

test("a single bound is refused rather than scanning everything", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  await expect(
    asAdmin.query(api.vouchers.periodSummary, { from: "2026-01-01" }),
  ).rejects.toThrow();
  await expect(
    asAdmin.query(api.vouchers.dailyBreakdown, { to: "2026-01-31" }),
  ).rejects.toThrow();
});

test("an explicitly unbounded range is refused rather than scanning everything", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  await expect(
    asAdmin.query(api.vouchers.periodSummary, { from: null, to: null }),
  ).rejects.toThrow();
  await expect(
    asAdmin.query(api.vouchers.dailyBreakdown, {
      from: "2026-01-01",
      to: null,
    }),
  ).rejects.toThrow();
});

test("revenue totals are exact for a combination of odd prices", async () => {
  const t = convexTest(schema, modules);
  const prices = [1201, 3333, 999, 50, 17];
  for (const [index, priceCents] of prices.entries()) {
    await insertVoucherAt(t, middayMs("2026-01-10") + index, {
      code: `p${index}`,
      priceCents,
    });
  }
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  const summary = await asAdmin.query(api.vouchers.periodSummary, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  expect(summary.revenueCents).toBe(
    prices.reduce((total, price) => total + price, 0),
  );
});

test("daily figures break the range down by day", async () => {
  const t = convexTest(schema, modules);
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "d1",
    priceCents: 5000,
    adults: 2,
  });
  await insertVoucherAt(t, middayMs("2026-01-05") + 1, {
    code: "d1b",
    priceCents: 1000,
    adults: 1,
  });
  await insertVoucherAt(t, middayMs("2026-01-07"), {
    code: "d2",
    priceCents: 2000,
    adults: 1,
    elderly: 1,
  });

  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  const days = await asAdmin.query(api.vouchers.dailyBreakdown, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  expect(days.map((day) => day.date)).toEqual(["2026-01-05", "2026-01-07"]);
  expect(days[0]).toMatchObject({
    voucherCount: 2,
    revenueCents: 6000,
    adults: 3,
  });
  expect(days[1]).toMatchObject({
    voucherCount: 1,
    revenueCents: 2000,
    visitorCount: 2,
  });
});

test("a Test Voucher inside the range changes no figure", async () => {
  const t = convexTest(schema, modules);
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "real",
    priceCents: 5000,
    adults: 2,
  });
  await insertVoucherAt(t, middayMs("2026-01-05") + 1, {
    code: "test",
    priceCents: 999999,
    adults: 99,
    isTest: true,
  });

  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  const summary = await asAdmin.query(api.vouchers.periodSummary, {
    from: "2026-01-01",
    to: "2026-01-31",
  });
  const days = await asAdmin.query(api.vouchers.dailyBreakdown, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  expect(summary.voucherCount).toBe(1);
  expect(summary.revenueCents).toBe(5000);
  expect(days).toEqual([
    expect.objectContaining({ date: "2026-01-05", voucherCount: 1, revenueCents: 5000 }),
  ]);
});

test("soft-deleted vouchers are excluded", async () => {
  const t = convexTest(schema, modules);
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "real",
    priceCents: 5000,
  });
  await insertVoucherAt(t, middayMs("2026-01-05") + 1, {
    code: "gone",
    priceCents: 999999,
    // Soft-deleted while sitting in the requested range.
  });
  await t.run(async (ctx) => {
    const gone = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "gone"))
      .unique();
    if (gone) {
      await ctx.db.patch(gone._id, { deletedAt: Date.now() });
    }
  });

  const asAdmin = t.withIdentity({ "properties.role": "admin" });
  const summary = await asAdmin.query(api.vouchers.periodSummary, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  expect(summary.voucherCount).toBe(1);
  expect(summary.revenueCents).toBe(5000);
});

test("a staff-role caller cannot reach either summary, including with a forged role argument", async () => {
  const t = convexTest(schema, modules);
  await insertVoucherAt(t, middayMs("2026-01-05"), { code: "a1b2" });
  const asEmployee = t.withIdentity({ "properties.role": "employee" });
  const forged = { role: "admin" } as unknown as Record<string, never>;

  await expect(
    asEmployee.query(api.vouchers.periodSummary, {
      from: "2026-01-01",
      to: "2026-01-31",
      ...forged,
    }),
  ).rejects.toThrow();
  await expect(
    asEmployee.query(api.vouchers.dailyBreakdown, {
      from: "2026-01-01",
      to: "2026-01-31",
      ...forged,
    }),
  ).rejects.toThrow();

  await expect(
    t.query(api.vouchers.periodSummary, {
      from: "2026-01-01",
      to: "2026-01-31",
    }),
  ).rejects.toThrow();
});
