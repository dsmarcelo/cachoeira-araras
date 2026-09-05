import { describe, expect, it } from "vitest";
import {
  readVouchers,
  removeVoucher,
  saveVoucher,
  VOUCHER_RETENTION_MS,
} from "./browser-storage";

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}
const now = Date.now();
const first = {
  code: "abcd",
  initPoint: "https://www.mercadopago.com.br/checkout",
  createdAt: now,
};
const second = { ...first, code: "efgh" };

describe("browser voucher history", () => {
  it("preserves two purchases across reads and removes only the selected entry", () => {
    const store = storage();
    saveVoucher(store, first, now);
    saveVoucher(store, second, now);
    expect(readVouchers(store, now)).toEqual([first, second]);
    expect(removeVoucher(store, first.code)).toEqual([second]);
    expect(readVouchers(store, now)).toEqual([second]);
  });

  it("migrates using the original creation time without renewing retention", () => {
    const store = storage();
    const old = { ...first, createdAt: now - VOUCHER_RETENTION_MS };
    saveVoucher(store, old, now);
    saveVoucher(store, first, now);
    expect(readVouchers(store, now)).toEqual([old]);
    expect(readVouchers(store, now + 1)).toEqual([]);
    expect(saveVoucher(store, old, now + 1)).toEqual([]);
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
});
