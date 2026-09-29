import type { Referrer, Voucher } from "@prisma/client";
import { describe, expect, test } from "vitest";

import {
  buildVoucherImportRow,
  foldReferrer,
  normalizeVoucherStatus,
  reaisToCents,
  splitExpiresAt,
} from "./transform";

function baseVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 1,
    name: "Visitor",
    phone: "62999999999",
    code: "abcd",
    adults: 1,
    elderly: 0,
    adults_pool: 0,
    elderly_pool: 0,
    price: 70,
    valid: false,
    status: "pending",
    preference_id: "pref-1",
    payment_id: null,
    expires_at: new Date("2026-08-03T03:00:00.000Z"),
    createdAt: new Date("2026-08-02T19:00:00.000Z"),
    updatedAt: new Date("2026-08-02T19:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("normalizeVoucherStatus", () => {
  test("normalises the legacy 'used' value to 'redeemed'", () => {
    expect(normalizeVoucherStatus("used")).toBe("redeemed");
  });

  test("passes already-valid statuses through unchanged", () => {
    for (const status of ["pending", "valid", "redeemed", "expired"]) {
      expect(normalizeVoucherStatus(status)).toBe(status);
    }
  });

  test("throws on an unrecognised status", () => {
    expect(() => normalizeVoucherStatus("cancelled")).toThrow(
      /Unrecognised legacy voucher status/,
    );
  });
});

describe("reaisToCents", () => {
  test("converts whole reais exactly", () => {
    expect(reaisToCents(70)).toBe(7000);
    expect(reaisToCents(0.01)).toBe(1);
  });

  test("rounds away floating-point drift instead of truncating it", () => {
    // 19.99 * 100 === 1998.9999999999998 in IEEE-754 double math.
    expect(reaisToCents(19.99)).toBe(1999);
    expect(reaisToCents(120.5)).toBe(12050);
  });
});

describe("splitExpiresAt", () => {
  test("recovers the Sao Paulo visit day from a legacy local-midnight expiry", () => {
    // 2026-08-03T03:00:00.000Z is exactly 2026-08-03T00:00:00 in Sao Paulo
    // (UTC-3), i.e. the instant the visit day before it (Aug 2) ends.
    const { visitDate, expiresAtMs } = splitExpiresAt(
      new Date("2026-08-03T03:00:00.000Z"),
    );
    expect(visitDate).toBe("2026-08-02");
    // Recomputed via endOfSaoPauloDayMs, one ms before the legacy timestamp.
    expect(expiresAtMs).toBe(new Date("2026-08-03T03:00:00.000Z").getTime() - 1);
  });

  test("derives a consistent visitDate for a pre-visit-date-era legacy row", () => {
    // Some of the oldest rows store expires_at as createdAt + a fixed
    // window, at an arbitrary time of day rather than Sao Paulo midnight.
    const { visitDate, expiresAtMs } = splitExpiresAt(
      new Date("2024-08-04T15:37:05.869Z"),
    );
    expect(visitDate).toBe("2024-08-04");
    // expiresAtMs is always recomputed as the end of that Sao Paulo day, not
    // copied from the odd input timestamp.
    expect(expiresAtMs).toBe(
      Date.UTC(2024, 7, 5, 2, 59, 59, 999),
    );
  });
});

describe("foldReferrer", () => {
  test("folds a legacy Referrer row into the embedded shape", () => {
    const referrer: Pick<Referrer, "referrer" | "url"> = {
      referrer: "Facebook",
      url: "https://example.com/?fbclid=1",
    };
    expect(foldReferrer(referrer)).toEqual({
      source: "Facebook",
      url: "https://example.com/?fbclid=1",
    });
  });

  test("is undefined for a voucher with no matching Referrer row", () => {
    expect(foldReferrer(null)).toBeUndefined();
    expect(foldReferrer(undefined)).toBeUndefined();
  });
});

describe("buildVoucherImportRow", () => {
  test("applies every transformation together", () => {
    const row = buildVoucherImportRow(
      baseVoucher({ status: "used", price: 19.99 }),
      { referrer: "Google", url: "https://example.com/?gclid=1" },
    );

    expect(row.status).toBe("redeemed");
    expect(row.priceCents).toBe(1999);
    expect(row.visitDate).toBe("2026-08-02");
    expect(row.referrer).toEqual({
      source: "Google",
      url: "https://example.com/?gclid=1",
    });
    expect(row.adultsPool).toBe(0);
    expect(row.elderlyPool).toBe(0);
    expect(row.purchasedAt).toBe(new Date("2026-08-02T19:00:00.000Z").getTime());
  });

  test("a voucher with no Referrer row stays valid, with referrer absent", () => {
    const row = buildVoucherImportRow(baseVoucher(), undefined);
    expect(row.referrer).toBeUndefined();
  });

  test("carries payment id and soft-delete timestamp through when present", () => {
    const row = buildVoucherImportRow(
      baseVoucher({
        payment_id: "pay-1",
        deletedAt: new Date("2026-08-03T21:51:01.000Z"),
      }),
      undefined,
    );
    expect(row.paymentId).toBe("pay-1");
    expect(row.deletedAt).toBe(new Date("2026-08-03T21:51:01.000Z").getTime());
  });

  test("throws when expires_at is missing", () => {
    expect(() =>
      buildVoucherImportRow(baseVoucher({ expires_at: null }), undefined),
    ).toThrow(/no expires_at/);
  });
});
