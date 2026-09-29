/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as "pending" | "valid" | "redeemed" | "expired" | "refunded",
    visitDate: "2026-01-05",
    expiresAt: Date.UTC(2026, 0, 6, 3, 0, 0) - 1,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    paymentTypeId: undefined as string | undefined,
    paymentMethodId: undefined as string | undefined,
    isTest: false,
  };
}

/** Inserts a voucher whose `_creationTime` is `atMs`; call in non-decreasing `atMs` order. */
async function insertVoucherAt(
  t: ReturnType<typeof createConvexTest>,
  atMs: number,
  overrides: Partial<ReturnType<typeof defaults>> & {
    reversal?: { reason: string; notedAt: number };
    referrer?: { source: string; url: string };
  } = {},
) {
  vi.useFakeTimers();
  vi.setSystemTime(atMs);
  try {
    await t.run(async (ctx) => ctx.db.insert("vouchers", { ...defaults(), ...overrides }));
  } finally {
    vi.useRealTimers();
  }
}

/** Midday on a Sao Paulo calendar date (15:00 UTC = 12:00 in UTC-3). */
function middayMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day, 15, 0, 0);
}

afterEach(() => {
  vi.useRealTimers();
});

test("net revenue counts only real vouchers with an approved, unreversed payment, compared against the previous period", async () => {
  const t = createConvexTest();
  // Previous period (2026-01-03..2026-01-04 for a two-day range).
  await insertVoucherAt(t, middayMs("2026-01-04"), { code: "prev", priceCents: 2000, paymentId: "p0" });
  // Current period.
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "pix",
    priceCents: 5000,
    paymentId: "p1",
    paymentTypeId: "bank_transfer",
    paymentMethodId: "pix",
    referrer: { source: "Instagram", url: "https://x/?igshid=1" },
  });
  await insertVoucherAt(t, middayMs("2026-01-05"), {
    code: "card",
    status: "redeemed",
    priceCents: 3000,
    paymentId: "p2",
    paymentTypeId: "credit_card",
    paymentMethodId: "master",
  });
  await insertVoucherAt(t, middayMs("2026-01-05"), { code: "refunded", status: "refunded", paymentId: "p3" });
  await insertVoucherAt(t, middayMs("2026-01-06"), {
    code: "chargeback",
    status: "redeemed",
    paymentId: "p4",
    reversal: { reason: "charged_back", notedAt: 1 },
  });
  // Marked valid by hand, no approved payment behind it.
  await insertVoucherAt(t, middayMs("2026-01-06"), { code: "manual", status: "valid" });
  await insertVoucherAt(t, middayMs("2026-01-06"), { code: "pending", status: "pending" });
  await insertVoucherAt(t, middayMs("2026-01-06"), { code: "test", isTest: true, paymentId: "p5" });

  const asAdmin = await withAuth(t, "admin");
  const report = await asAdmin.query(api.finance.financialReport, {
    from: "2026-01-05",
    to: "2026-01-06",
  });

  expect(report).toMatchObject({
    previousFrom: "2026-01-03",
    previousTo: "2026-01-04",
    granularity: "day",
    netCents: 8000,
    previousNetCents: 2000,
    voucherCount: 2,
    referrers: [
      { key: "Instagram", netCents: 5000, voucherCount: 1 },
      { key: "", netCents: 3000, voucherCount: 1 },
    ],
    paymentMethods: [
      { key: "pix", netCents: 5000, voucherCount: 1 },
      { key: "credit_card", netCents: 3000, voucherCount: 1 },
    ],
  });
  // Zero-filled: the second day has no counted sale but still gets a bucket.
  expect(report.buckets.map((b) => [b.from, b.netCents])).toEqual([
    ["2026-01-05", 8000],
    ["2026-01-06", 0],
  ]);
  expect(report.recent.map((r) => r.code).sort()).toEqual(["card", "pix"]);
});

test("a range longer than the limit is refused", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");
  await expect(
    asAdmin.query(api.finance.financialReport, { from: "2025-01-01", to: "2026-06-01" }),
  ).rejects.toThrow(/366 dias/);
});
