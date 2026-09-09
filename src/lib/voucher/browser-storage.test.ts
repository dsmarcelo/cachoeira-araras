import { describe, expect, it } from "vitest";
import {
  canRemoveVoucher,
  isVoucherRemoved,
  isVoucherRetained,
  LEGACY_VOUCHER_RETENTION_MS,
  readVouchers,
  removeVoucher,
  saveVoucher,
  touchFinancialEvent,
  VOUCHER_RETENTION_MS,
  VOUCHERS_KEY,
} from "./browser-storage";

function storage(initial: string | null = null) {
  let value = initial;
  const store = new Map<string, string>();
  if (initial !== null) {
    store.set(VOUCHERS_KEY, initial);
  }
  return {
    getItem: (key: string) => (key === VOUCHERS_KEY ? (value ?? store.get(key) ?? null) : store.get(key) ?? null),
    setItem: (key: string, next: string) => {
      if (key === VOUCHERS_KEY) value = next;
      store.set(key, next);
    },
  };
}

const now = Date.now();
const first = {
  code: "abcd",
  initPoint: "https://www.mercadopago.com.br/checkout",
  createdAt: now,
  schemaVersion: 2,
};
const second = { ...first, code: "efgh" };

describe("browser voucher history (60-day retention with financial-event extension)", () => {
  it("uses 60 days as default retention and 90 days as legacy retention", () => {
    expect(VOUCHER_RETENTION_MS).toBe(60 * 24 * 60 * 60 * 1000);
    expect(LEGACY_VOUCHER_RETENTION_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("preserves two purchases across reads and removes only the selected entry", () => {
    const store = storage();
    saveVoucher(store, first, now);
    saveVoucher(store, second, now);
    expect(readVouchers(store, now)).toEqual([first, second]);
    expect(removeVoucher(store, first.code)).toEqual([second]);
    expect(readVouchers(store, now)).toEqual([second]);
  });

  it("retains vouchers for 60 days from creation and drops them after 60 days", () => {
    const store = storage();
    const exactBoundary = { ...first, createdAt: now - VOUCHER_RETENTION_MS };
    saveVoucher(store, exactBoundary, now);
    expect(readVouchers(store, now)).toEqual([exactBoundary]);
    expect(readVouchers(store, now + 1)).toEqual([]);
    expect(saveVoucher(store, exactBoundary, now + 1)).toEqual([]);
  });

  it("restarts the 60-day retention window on the latest financial event", () => {
    const store = storage();
    // Created 80 days ago, but experienced a financial event 10 days ago
    const eventTime = now - 10 * 24 * 60 * 60 * 1000;
    const withEvent = {
      ...first,
      createdAt: now - 80 * 24 * 60 * 60 * 1000,
      lastFinancialEventAt: eventTime,
    };
    saveVoucher(store, withEvent, now);
    // Retained because now - lastFinancialEventAt = 10 days <= 60 days
    expect(readVouchers(store, now)).toEqual([withEvent]);

    // Touching financial event extends retention for another 60 days
    touchFinancialEvent(store, first.code, { eventAt: now }, now);
    const updated = readVouchers(store, now);
    expect(updated[0]?.lastFinancialEventAt).toBe(now);

    // At now + 59 days: still retained
    expect(
      readVouchers(store, now + 59 * 24 * 60 * 60 * 1000).length,
    ).toBe(1);

    // At now + 60 days + 1ms: expires
    expect(
      readVouchers(store, now + VOUCHER_RETENTION_MS + 1),
    ).toEqual([]);
  });

  it("neither auto-expires nor allows manual removal of a voucher with open or failed refund", () => {
    const store = storage();
    // Voucher created 200 days ago with a pending refund
    const pendingRefundVoucher = {
      ...first,
      createdAt: now - 200 * 24 * 60 * 60 * 1000,
      hasPendingRefund: true,
    };
    saveVoucher(store, pendingRefundVoucher, now);

    // Never auto-expires past the window
    expect(readVouchers(store, now)).toEqual([pendingRefundVoucher]);
    expect(canRemoveVoucher(pendingRefundVoucher)).toBe(false);
    expect(isVoucherRetained(pendingRefundVoucher, now + 365 * 24 * 60 * 60 * 1000)).toBe(true);

    // Cannot be removed by hand through removeVoucher
    const remaining = removeVoucher(store, first.code);
    expect(remaining).toEqual([pendingRefundVoucher]);
    expect(readVouchers(store, now)).toEqual([pendingRefundVoucher]);
  });

  it("allows removing local reference after clean cancellation or confirmed refund", () => {
    const store = storage();
    const confirmedRefundVoucher = {
      ...first,
      hasPendingRefund: false,
    };
    saveVoucher(store, confirmedRefundVoucher, now);
    expect(canRemoveVoucher(confirmedRefundVoucher)).toBe(true);

    const afterRemove = removeVoucher(store, first.code);
    expect(afterRemove).toEqual([]);
    expect(readVouchers(store, now)).toEqual([]);
  });

  it("ensures removal persists across subsequent visits in that browser", () => {
    const store = storage();
    saveVoucher(store, first, now);
    removeVoucher(store, first.code);

    expect(isVoucherRemoved(store, first.code)).toBe(true);

    // On next visit, readVouchers still returns empty
    expect(readVouchers(store, now)).toEqual([]);

    // Stale background save (e.g. from cookie migration) will not resurrect the removed voucher
    saveVoucher(store, first, now);
    expect(readVouchers(store, now)).toEqual([]);
  });

  it("migrates existing stored entries from 90-day rules without loss", () => {
    // Legacy storage entry: no schemaVersion, created 75 days ago (valid under old 90-day rule)
    const legacyCreatedAt = now - 75 * 24 * 60 * 60 * 1000;
    const store = storage(
      JSON.stringify([
        {
          code: "legacy-75",
          initPoint: "https://www.mercadopago.com.br/checkout",
          createdAt: legacyCreatedAt,
        },
        {
          code: "legacy-95",
          initPoint: "https://www.mercadopago.com.br/checkout",
          createdAt: now - 95 * 24 * 60 * 60 * 1000,
        },
      ]),
    );

    const migrated = readVouchers(store, now);
    // legacy-75 is migrated without loss (retained with schemaVersion: 2 and extended)
    expect(migrated.length).toBe(1);
    expect(migrated[0]?.code).toBe("legacy-75");
    expect(migrated[0]?.schemaVersion).toBe(2);
    expect(migrated[0]?.lastFinancialEventAt).toBe(now);

    // legacy-95 was older than 90 days, so dropped
    expect(migrated.find((v) => v.code === "legacy-95")).toBeUndefined();
  });

  it("prunes expired entries on write and preserves other tabs' purchases", () => {
    const store = storage(
      JSON.stringify([
        { ...first, createdAt: now - VOUCHER_RETENTION_MS - 1 },
        second,
      ]),
    );
    expect(saveVoucher(store, { ...first, code: "ijkl" }, now)).toEqual([
      second,
      { ...first, code: "ijkl" },
    ]);
  });

  it("recovers malformed JSON and rejects invalid entries and unsafe checkout URLs", () => {
    expect(readVouchers(storage("broken"), now)).toEqual([]);
    expect(readVouchers(storage('{"code":"abcd"}'), now)).toEqual([]);
    const store = storage(
      JSON.stringify([
        null,
        first,
        { ...second, initPoint: "javascript:alert(1)" },
        { ...second, createdAt: "today" },
      ]),
    );
    expect(readVouchers(store, now)).toEqual([first]);
  });

  it("reports unavailable reads and failed writes to the caller", () => {
    const unavailable = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    };
    expect(() => readVouchers(unavailable)).toThrow("blocked");
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveVoucher(full, first, now)).toThrow("quota");
  });

  it("stores and preserves managementToken when present", () => {
    const store = storage();
    const withToken = {
      ...first,
      managementToken: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    };
    saveVoucher(store, withToken, now);
    expect(readVouchers(store, now)).toEqual([withToken]);
  });
});
