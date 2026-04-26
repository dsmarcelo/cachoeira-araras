import assert from "node:assert/strict";
import test from "node:test";

import { TRPCError } from "@trpc/server";

import {
  calculateVoucherPurchasePrice,
  validateVoucherPurchase,
  type VoucherPurchaseInput,
} from "./voucher-purchase.ts";

const settings = {
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

const now = new Date("2026-04-25T12:00:00-03:00");
const intendedDate = new Date("2026-04-26T12:00:00-03:00");

function validInput(overrides: Partial<VoucherPurchaseInput> = {}) {
  return {
    adults: 1,
    elderly: 0,
    adults_pool: 0,
    elderly_pool: 0,
    intendedDate,
    ...overrides,
  };
}

function assertTRPCError(
  action: () => unknown,
  code: TRPCError["code"],
  message: string,
) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, code);
    assert.equal(error.message, message);
    return true;
  });
}

await test("calculates prices from settings", () => {
  assert.equal(
    calculateVoucherPurchasePrice({
      input: validInput({
        adults: 2,
        elderly: 1,
        adults_pool: 1,
        elderly_pool: 1,
      }),
      settings,
    }),
    230,
  );
});

await test("blocks pool purchase when disabled", () => {
  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput({ adults: 0, adults_pool: 1 }), {
        now,
        settings: {
          ...settings,
          "enable.voucher.pool.buy": false,
        },
      }),
    "FORBIDDEN",
    "Compra de voucher com piscina está desativada.",
  );
});

await test("blocks half-price purchases when disabled", () => {
  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput({ adults: 0, elderly: 1 }), {
        now,
        settings: {
          ...settings,
          "enable.voucher.half-price.buy": false,
        },
      }),
    "FORBIDDEN",
    "Compra de voucher meia entrada está desativada.",
  );

  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput({ adults: 0, elderly_pool: 1 }), {
        now,
        settings: {
          ...settings,
          "enable.voucher.half-price.pool.buy": false,
        },
      }),
    "FORBIDDEN",
    "Compra de voucher meia entrada com piscina está desativada.",
  );
});

await test("blocks quantities above configured limits", () => {
  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput({ adults: 3 }), {
        now,
        settings: {
          ...settings,
          "voucher.max.quantity.adults": 2,
        },
      }),
    "BAD_REQUEST",
    "Quantidade de inteiras acima do limite permitido.",
  );
});

await test("blocks disabled dates and dates beyond max intended days", () => {
  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput(), {
        now,
        settings: {
          ...settings,
          "disabled.days": ["2026-04-26"],
        },
      }),
    "BAD_REQUEST",
    "Data de visita indisponível.",
  );

  assertTRPCError(
    () =>
      validateVoucherPurchase(
        validInput({ intendedDate: new Date("2026-04-28T12:00:00-03:00") }),
        {
          now,
          settings: {
            ...settings,
            "max.intended.days": 1,
          },
        },
      ),
    "BAD_REQUEST",
    "Data de visita além do limite permitido.",
  );
});

await test("allows test mode only for authorized staff", () => {
  assertTRPCError(
    () =>
      validateVoucherPurchase(validInput({ testMode: true }), {
        now,
        settings,
      }),
    "UNAUTHORIZED",
    "Modo de teste disponível apenas para equipe autorizada.",
  );

  assert.equal(
    validateVoucherPurchase(validInput({ testMode: true }), {
      canUseTestMode: true,
      now,
      settings,
    }).price,
    0.01,
  );
});
