import assert from "node:assert/strict";
import test from "node:test";

import type { SettingValueMap } from "../lib/settings";
import {
  classifyReferrer,
  createVoucherPurchaseIntake,
  type StartVoucherCheckoutInput,
} from "./voucher-purchase-intake-core.ts";

const settings: SettingValueMap = {
  "voucher.price": 50,
  "voucher.pool.price": 70,
  "voucher.max.quantity.adults": 20,
  "voucher.max.quantity.elderly": 20,
  "voucher.max.quantity.adults.pool": 20,
  "voucher.max.quantity.elderly.pool": 20,
  "top.message": "",
  "form.message": "",
  "max.intended.days": 60,
  "disabled.days": [],
  "enable.voucher.buy": true,
  "enable.voucher.pool.buy": true,
  "enable.voucher.half-price.buy": true,
  "enable.voucher.half-price.pool.buy": true,
};

const validInput: StartVoucherCheckoutInput = {
  name: "Maria Silva",
  phone: "11999999999",
  adults: 2,
  elderly: 1,
  adults_pool: 0,
  elderly_pool: 0,
  intendedDate: new Date("2026-05-10T12:00:00-03:00"),
  referrerUrl: "https://example.com/?fbclid=abc",
};

await test("starts checkout with server-owned voucher state", async () => {
  const createdVouchers: unknown[] = [];
  const preferences: unknown[] = [];
  const referrers: unknown[] = [];
  const intake = createVoucherPurchaseIntake({
    createCheckoutPreference: async (preference) => {
      preferences.push(preference);
      return {
        id: "pref_123",
        initPoint: "https://mercadopago.example/checkout",
      };
    },
    createPendingVoucher: async (voucher) => {
      createdVouchers.push(voucher);
      return {};
    },
    createReferrerAttribution: async (referrer) => {
      referrers.push(referrer);
      return {};
    },
    findVoucherByCode: async () => null,
    generateCode: () => "a1b2",
    getSettings: async () => settings,
    isUniqueConstraintError: () => false,
  });

  const result = await intake(validInput);

  assert.deepEqual(result, {
    code: "a1b2",
    preferenceId: "pref_123",
    initPoint: "https://mercadopago.example/checkout",
    price: 125,
  });
  assert.deepEqual(createdVouchers, [
    {
      name: "Maria Silva",
      phone: "11999999999",
      adults: 2,
      elderly: 1,
      adults_pool: 0,
      elderly_pool: 0,
      code: "a1b2",
      price: 125,
      preferenceId: "pref_123",
      expiresAt: validInput.intendedDate,
    },
  ]);
  assert.equal(preferences.length, 1);
  assert.deepEqual(referrers, [
    {
      voucherCode: "a1b2",
      referrer: "Facebook",
      url: "https://example.com/?fbclid=abc",
    },
  ]);
});

await test("retries voucher code collisions before creating a preference", async () => {
  const generatedCodes = ["used", "free"];
  const preferenceCodes: string[] = [];
  const intake = createVoucherPurchaseIntake({
    createCheckoutPreference: async (preference) => {
      preferenceCodes.push(preference.code);
      return {
        id: "pref_456",
        initPoint: "https://mercadopago.example/checkout",
      };
    },
    createPendingVoucher: async () => ({}),
    createReferrerAttribution: async () => ({}),
    findVoucherByCode: async (code) => (code === "used" ? { code } : null),
    generateCode: () => generatedCodes.shift() ?? "free",
    getSettings: async () => settings,
    isUniqueConstraintError: () => false,
  });

  const result = await intake({
    ...validInput,
    referrerUrl: null,
  });

  assert.equal(result.code, "free");
  assert.deepEqual(preferenceCodes, ["free"]);
});

await test("does not fail checkout when referrer attribution fails", async () => {
  const warnings: unknown[] = [];
  const intake = createVoucherPurchaseIntake({
    createCheckoutPreference: async () => ({
      id: "pref_789",
      initPoint: "https://mercadopago.example/checkout",
    }),
    createPendingVoucher: async () => ({}),
    createReferrerAttribution: async () => {
      throw new Error("referrer write failed");
    },
    findVoucherByCode: async () => null,
    generateCode: () => "z9y8",
    getSettings: async () => settings,
    isUniqueConstraintError: () => false,
    logger: {
      error() {
        return undefined;
      },
      warn(...args: unknown[]) {
        warnings.push(args);
      },
    },
  });

  const result = await intake(validInput);

  assert.equal(result.code, "z9y8");
  assert.equal(warnings.length, 1);
});

await test("classifies known referrer URLs", () => {
  assert.equal(classifyReferrer("https://example.com/?fbclid=1"), "Facebook");
  assert.equal(classifyReferrer("https://example.com/?gclid=1"), "Google");
  assert.equal(classifyReferrer("https://example.com/?igshid=1"), "Instagram");
  assert.equal(classifyReferrer("https://mail.google.com/mail/u/0"), "Gmail");
  assert.equal(classifyReferrer("https://example.com"), "");
});
