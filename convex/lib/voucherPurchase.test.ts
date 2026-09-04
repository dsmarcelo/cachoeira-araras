import { describe, expect, test } from "vitest";

import type { SettingValueMap } from "./settings";
import {
  calculateVoucherPurchasePriceCents,
  validateVoucherPurchase,
  type VoucherPurchaseInput,
} from "./voucherPurchase";

const settings: SettingValueMap = {
  "voucher.price": 5000,
  "voucher.pool.price": 7000,
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

const now = new Date("2026-04-25T12:00:00-03:00");
const visitDate = "2026-04-26";

function validInput(
  overrides: Partial<VoucherPurchaseInput> = {},
): VoucherPurchaseInput {
  return {
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    visitDate,
    ...overrides,
  };
}

describe("quantity validity", () => {
  test("rejects a negative quantity", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: -1 }), { now, settings }),
    ).toThrow(/Quantidade inválida/);
  });

  test("rejects a fractional quantity", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 1.5 }), { now, settings }),
    ).toThrow(/Quantidade inválida/);
  });

  test("rejects an empty purchase", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 0 }), { now, settings }),
    ).toThrow(/ao menos uma entrada/);
  });

  test("calculates the price in cents from settings, rounding half-price cents", () => {
    const result = validateVoucherPurchase(
      validInput({ adults: 2, elderly: 1, adultsPool: 1, elderlyPool: 1 }),
      { now, settings },
    );
    expect(result.priceCents).toBe(
      calculateVoucherPurchasePriceCents({
        input: validInput({
          adults: 2,
          elderly: 1,
          adultsPool: 1,
          elderlyPool: 1,
        }),
        settings,
      }),
    );
    // 2*5000 + round(5000/2) + 1*7000 + round(7000/2) = 10000+2500+7000+3500
    expect(result.priceCents).toBe(23000);
  });
});

describe("per-type limits", () => {
  test("rejects a quantity above the configured limit", () => {
    expect(() =>
      validateVoucherPurchase(
        validInput({ adults: 21 }),
        { now, settings: { ...settings, "voucher.max.quantity.adults": 20 } },
      ),
    ).toThrow(/acima do limite/);
  });

  test("allows a quantity at exactly the limit", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 20 }), { now, settings }),
    ).not.toThrow();
  });
});

describe("enable toggles", () => {
  test("blocks a normal purchase when disabled", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 1 }), {
        now,
        settings: { ...settings, "enable.voucher.buy": false },
      }),
    ).toThrow(/voucher normal está desativada/);
  });

  test("blocks a half-price purchase when disabled", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 0, elderly: 1 }), {
        now,
        settings: { ...settings, "enable.voucher.half-price.buy": false },
      }),
    ).toThrow(/meia entrada está desativada/);
  });

  test("blocks a pool purchase when disabled", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 0, adultsPool: 1 }), {
        now,
        settings: { ...settings, "enable.voucher.pool.buy": false },
      }),
    ).toThrow(/com piscina está desativada/);
  });

  test("blocks a half-price pool purchase when disabled", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ adults: 0, elderlyPool: 1 }), {
        now,
        settings: {
          ...settings,
          "enable.voucher.half-price.pool.buy": false,
        },
      }),
    ).toThrow(/meia entrada com piscina está desativada/);
  });
});

describe("visit-date window", () => {
  test("rejects a date in the past", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ visitDate: "2026-04-24" }), {
        now,
        settings,
      }),
    ).toThrow(/não pode estar no passado/);
  });

  test("allows today", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ visitDate: "2026-04-25" }), {
        now,
        settings,
      }),
    ).not.toThrow();
  });

  test("rejects a date beyond the booking window", () => {
    expect(() =>
      validateVoucherPurchase(
        validInput({ visitDate: "2026-07-01" }),
        { now, settings: { ...settings, "max.intended.days": 10 } },
      ),
    ).toThrow(/além do limite/);
  });

  test("rejects a disabled day", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ visitDate }), {
        now,
        settings: { ...settings, "disabled.days": [visitDate] },
      }),
    ).toThrow(/indisponível/);
  });

  test("rejects a malformed date key", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ visitDate: "not-a-date" }), {
        now,
        settings,
      }),
    ).toThrow(/inválida/);
  });
});

describe("test mode", () => {
  test("rejects test mode when the caller is not authorised", () => {
    expect(() =>
      validateVoucherPurchase(validInput({ testMode: true }), {
        now,
        settings,
        canUseTestMode: false,
      }),
    ).toThrow(/equipe autorizada/);
  });

  test("charges one cent in test mode for an authorised caller", () => {
    const result = validateVoucherPurchase(
      validInput({ adults: 5, testMode: true }),
      { now, settings, canUseTestMode: true },
    );
    expect(result.priceCents).toBe(1);
  });
});
