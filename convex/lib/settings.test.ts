import { afterEach, expect, test, vi } from "vitest";

import { mergeSettings } from "./settings";

afterEach(() => vi.unstubAllEnvs());

test("voucher prices default to R$ 70,00 and ignore old database prices", () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "");
  vi.stubEnv("NEXT_PUBLIC_POOL_VOUCHER_PRICE", "");

  const settings = mergeSettings([
    { key: "voucher.price", value: 5000 },
    { key: "voucher.pool.price", value: 9000 },
  ]);

  expect(settings["voucher.price"]).toBe(7000);
  expect(settings["voucher.pool.price"]).toBe(7000);
});

test("voucher prices accept reais from the environment", () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "72,50");
  vi.stubEnv("NEXT_PUBLIC_POOL_VOUCHER_PRICE", "85.90");

  const settings = mergeSettings([]);

  expect(settings["voucher.price"]).toBe(7250);
  expect(settings["voucher.pool.price"]).toBe(8590);
});

test("prices with more than two decimals round to cents with a one-cent minimum", () => {
  vi.stubEnv("NEXT_PUBLIC_VOUCHER_PRICE", "0,0001");
  vi.stubEnv("NEXT_PUBLIC_POOL_VOUCHER_PRICE", "1.005");

  const settings = mergeSettings([]);

  expect(settings["voucher.price"]).toBe(1);
  expect(settings["voucher.pool.price"]).toBe(101);
});
