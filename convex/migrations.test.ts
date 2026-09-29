/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";

function legacyVoucher(code: string, overrides: Record<string, unknown> = {}) {
  return {
    code,
    name: "José Conceição",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as const,
    visitDate: "2026-09-10",
    expiresAt: Date.now() + 1000,
    preferenceId: "pref",
    isTest: false,
    ...overrides,
  };
}

test("the backfill fills missing purchasedAt, searchText and isActive across batches and keeps existing values", async () => {
  const t = createConvexTest();
  await t.run(async (ctx) => {
    // More than one batch of 200 to exercise the self-rescheduling cursor.
    for (let i = 0; i < 205; i++) {
      await ctx.db.insert("vouchers", legacyVoucher(`c${i}`));
    }
    await ctx.db.insert(
      "vouchers",
      legacyVoucher("kept", { purchasedAt: 123, searchText: "custom" }),
    );
    await ctx.db.insert("vouchers", legacyVoucher("gone", { deletedAt: 5 }));
    await ctx.db.insert("vouchers", legacyVoucher("test", { isTest: true }));
  });

  vi.useFakeTimers();
  try {
    await t.mutation(
      internal.migrations.backfillVoucherPurchasedAtAndSearchText,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }

  const rows = await t.run(async (ctx) => ctx.db.query("vouchers").collect());
  expect(rows).toHaveLength(208);
  for (const row of rows) {
    expect(row.purchasedAt).toBeDefined();
    expect(row.searchText).toBeDefined();
    expect(row.isActive).toBeDefined();
  }
  const byCode = new Map(rows.map((r) => [r.code, r]));
  expect(byCode.get("c0")?.purchasedAt).toBe(byCode.get("c0")?._creationTime);
  expect(byCode.get("c0")?.searchText).toBe("c0 jose conceicao 11999999999");
  expect(byCode.get("kept")?.purchasedAt).toBe(123);
  expect(byCode.get("kept")?.searchText).toBe("custom");
  expect(byCode.get("c0")?.isActive).toBe(true);
  expect(byCode.get("gone")?.isActive).toBe(false);
  expect(byCode.get("test")?.isActive).toBe(false);
});
