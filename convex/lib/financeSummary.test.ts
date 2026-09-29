import { expect, test } from "vitest";

import type { Doc } from "../_generated/dataModel";
import { summarizeDay } from "./financeSummary";

function voucher(overrides: Partial<Doc<"vouchers">>): Doc<"vouchers"> {
  return {
    _id: "v" as Doc<"vouchers">["_id"],
    _creationTime: 0,
    code: "a1b2",
    name: "Visitante",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid",
    visitDate: "2026-01-05",
    expiresAt: 0,
    preferenceId: "pref",
    paymentId: "p1",
    isTest: false,
    ...overrides,
  };
}

// 2026-01-05 12:00 in Sao Paulo (UTC-3).
const noon = Date.UTC(2026, 0, 5, 15, 0, 0);

test("summarizeDay totals only revenue vouchers, by hour, referrer and payment method", () => {
  const summary = summarizeDay("2026-01-05", [
    voucher({ purchasedAt: noon, paymentMethodId: "pix", paymentTypeId: "bank_transfer", referrer: { source: "Instagram", url: "u" } }),
    voucher({ purchasedAt: noon + 60_000, priceCents: 3000, status: "redeemed", paymentTypeId: "credit_card" }),
    // Missing purchasedAt falls back to _creationTime (02:00 Sao Paulo).
    voucher({ _creationTime: Date.UTC(2026, 0, 5, 5, 0, 0), priceCents: 1000 }),
    voucher({ purchasedAt: noon, status: "refunded" }),
    voucher({ purchasedAt: noon, paymentId: undefined }),
    voucher({ purchasedAt: noon, isTest: true }),
    voucher({ purchasedAt: noon, deletedAt: 1 }),
    voucher({ purchasedAt: noon, reversal: { reason: "charged_back", notedAt: 1 } }),
  ]);

  expect(summary).toMatchObject({
    date: "2026-01-05",
    netCents: 9000,
    voucherCount: 3,
    referrers: [
      { key: "Instagram", netCents: 5000, voucherCount: 1 },
      { key: "", netCents: 4000, voucherCount: 2 },
    ],
    paymentMethods: [
      { key: "pix", netCents: 5000, voucherCount: 1 },
      { key: "credit_card", netCents: 3000, voucherCount: 1 },
      { key: "", netCents: 1000, voucherCount: 1 },
    ],
  });
  expect(summary.hours).toHaveLength(24);
  expect(summary.hours[12]).toEqual({ netCents: 8000, voucherCount: 2 });
  expect(summary.hours[2]).toEqual({ netCents: 1000, voucherCount: 1 });
});

test("summarizeDay of a day without revenue is empty", () => {
  const summary = summarizeDay("2026-01-05", [voucher({ status: "pending", paymentId: undefined })]);
  expect(summary.voucherCount).toBe(0);
  expect(summary.netCents).toBe(0);
});
