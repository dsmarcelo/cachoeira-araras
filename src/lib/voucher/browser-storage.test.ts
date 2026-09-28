import { describe, expect, it } from "vitest";
import {
  isVoucherRetained,
  readVouchers,
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
    getItem: (key: string) =>
      key === VOUCHERS_KEY
        ? (value ?? store.get(key) ?? null)
        : (store.get(key) ?? null),
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

const DAY_MS = 24 * 60 * 60 * 1000;

describe("browser voucher history (2-year retention with financial-event extension)", () => {
  it("uses two years as retention", () => {
    expect(VOUCHER_RETENTION_MS).toBe(2 * 365 * DAY_MS);
  });

  it("preserves every purchase across reads", () => {
    const store = storage();
    saveVoucher(store, first, now);
    saveVoucher(store, second, now);
    expect(readVouchers(store, now)).toEqual([first, second]);
  });

  it("retains vouchers for two years from creation and drops them afterwards", () => {
    const store = storage();
    const exactBoundary = { ...first, createdAt: now - VOUCHER_RETENTION_MS };
    saveVoucher(store, exactBoundary, now);
    expect(readVouchers(store, now)).toEqual([exactBoundary]);
    expect(readVouchers(store, now + 1)).toEqual([]);
    expect(saveVoucher(store, exactBoundary, now + 1)).toEqual([]);
  });

  it("temporarily exposes expired capable entries so unseen refunds can be reconciled", () => {
    const expired = {
      ...first,
      managementToken: "secret-capability",
      createdAt: now - VOUCHER_RETENTION_MS - 1,
    };
    const store = storage(JSON.stringify([expired]));

    expect(readVouchers(store, now, { retainExpiredCandidates: true })).toEqual(
      [expired],
    );
    expect(readVouchers(store, now)).toEqual([]);
  });

  it("restarts the retention window on the latest financial event", () => {
    const store = storage();
    // Created past the window, but experienced a financial event 10 days ago
    const withEvent = {
      ...first,
      createdAt: now - VOUCHER_RETENTION_MS - 20 * DAY_MS,
      lastFinancialEventAt: now - 10 * DAY_MS,
    };
    saveVoucher(store, withEvent, now);
    expect(readVouchers(store, now)).toEqual([withEvent]);

    // Touching a financial event extends retention for another full window
    touchFinancialEvent(store, first.code, { eventAt: now }, now);
    const updated = readVouchers(store, now);
    expect(updated[0]?.lastFinancialEventAt).toBe(now);

    expect(readVouchers(store, now + VOUCHER_RETENTION_MS).length).toBe(1);
    expect(readVouchers(store, now + VOUCHER_RETENTION_MS + 1)).toEqual([]);
  });

  it("never auto-expires a voucher with an open or failed refund", () => {
    const store = storage();
    const pendingRefundVoucher = {
      ...first,
      createdAt: now - VOUCHER_RETENTION_MS - DAY_MS,
      hasPendingRefund: true,
    };
    saveVoucher(store, pendingRefundVoucher, now);

    expect(readVouchers(store, now)).toEqual([pendingRefundVoucher]);
    expect(
      isVoucherRetained(pendingRefundVoucher, now + VOUCHER_RETENTION_MS * 2),
    ).toBe(true);
  });

  it("migrates entries stored before schema versioning under the same retention", () => {
    const store = storage(
      JSON.stringify([
        {
          code: "legacy-recent",
          initPoint: "https://www.mercadopago.com.br/checkout",
          createdAt: now - 400 * DAY_MS,
        },
        {
          code: "legacy-old",
          initPoint: "https://www.mercadopago.com.br/checkout",
          createdAt: now - VOUCHER_RETENTION_MS - DAY_MS,
        },
      ]),
    );

    const migrated = readVouchers(store, now);
    expect(migrated.map((v) => v.code)).toEqual(["legacy-recent"]);
    expect(migrated[0]?.schemaVersion).toBe(2);
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
