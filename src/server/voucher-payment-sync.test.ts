import assert from "node:assert/strict";
import test from "node:test";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import {
  createVoucherPaymentSync,
  syncDisplayedVoucherPage,
} from "./voucher-payment-sync-core.ts";
import { pendingVoucher } from "./voucher-payment-test-fixtures.ts";

await test("recovers an approved payment without a webhook or stored payment id", async () => {
  const voucher = pendingVoucher({ payment_id: null });
  const payment: PaymentResponse = {
    api_response: { status: 200, headers: ["", []] },
    id: 123,
    status: "approved",
    external_reference: "a1b2",
    transaction_amount: 50,
    currency_id: "BRL",
  };
  let conversions = 0;
  const sync = createVoucherPaymentSync({
    getPayment: async () => payment,
    searchPayments: async (code) => {
      assert.equal(code, "a1b2");
      return [{ id: "123", status: "approved", externalReference: "a1b2" }];
    },
    confirmPayment: async (input) => {
      assert.equal(input.paymentId, "123");
      return {
        outcome: "updated",
        shouldSendConversionEvents: true,
        voucher: {
          ...voucher,
          status: "valid",
          valid: true,
          payment_id: "123",
        },
      };
    },
    sendConversionEvents: async () => {
      conversions += 1;
    },
    onError: () => undefined,
  });
  const result = await sync(voucher);
  assert.equal(result.voucher.status, "valid");
  assert.equal(result.voucher.payment_id, "123");
  assert.equal(result.syncError, null);
  assert.equal(conversions, 1);
});

function approvedPayment(
  overrides: Partial<PaymentResponse> = {},
): PaymentResponse {
  return {
    api_response: { status: 200, headers: ["", []] },
    id: 123,
    status: "approved",
    external_reference: "a1b2",
    transaction_amount: 50,
    currency_id: "BRL",
    ...overrides,
  };
}

for (const overrides of [
  { external_reference: "zzzz" },
  { transaction_amount: 1 },
  { currency_id: "USD" },
]) {
  await test(`rejects mismatched payment ${JSON.stringify(overrides)}`, async () => {
    const sync = createVoucherPaymentSync({
      getPayment: async () => approvedPayment(overrides),
      searchPayments: async () => [],
      confirmPayment: async () => {
        assert.fail("must not confirm");
      },
      sendConversionEvents: async () => {
        assert.fail("must not send conversions");
      },
      onError: () => undefined,
    });
    const result = await sync(pendingVoucher(), "123");
    assert.equal(result.voucher.status, "pending");
    assert.equal(result.syncError, "invalid_payment");
  });
}

await test("API errors preserve local state and are distinguishable from pending payment", async () => {
  const sync = createVoucherPaymentSync({
    getPayment: async () => {
      throw new Error("429 / timeout");
    },
    searchPayments: async () => [],
    confirmPayment: async () => {
      assert.fail("must not confirm");
    },
    sendConversionEvents: async () => undefined,
    onError: () => undefined,
  });
  const result = await sync(pendingVoucher());
  assert.equal(result.voucher.status, "pending");
  assert.equal(result.syncError, "unavailable");
});

await test("an unknown payment id in a customer link cannot trigger recovery by short code", async () => {
  const sync = createVoucherPaymentSync({
    getPayment: async () => null,
    searchPayments: async () => {
      assert.fail("must not search using an unverified link");
    },
    confirmPayment: async () => {
      assert.fail("must not confirm");
    },
    sendConversionEvents: async () => undefined,
    onError: () => undefined,
  });
  const result = await sync(pendingVoucher(), "999999");
  assert.equal(result.syncError, "invalid_payment");
  assert.equal(result.voucher.status, "pending");
});

await test("rejected attempts stay pending and can recover a later approved attempt", async () => {
  let approved = false;
  const sync = createVoucherPaymentSync({
    getPayment: async (id) =>
      approvedPayment({
        id: Number(id),
        status: id === "456" ? "approved" : "rejected",
      }),
    searchPayments: async () =>
      approved
        ? [{ id: "456", status: "approved", externalReference: "a1b2" }]
        : [],
    confirmPayment: async (input) => ({
      outcome: "updated",
      shouldSendConversionEvents: true,
      voucher: pendingVoucher({
        status: "valid",
        valid: true,
        payment_id: input.paymentId,
      }),
    }),
    sendConversionEvents: async () => undefined,
    onError: () => undefined,
  });
  assert.equal((await sync(pendingVoucher())).voucher.status, "pending");
  approved = true;
  // Returning to the customer's screen must bypass a pre-payment cooldown.
  const result = await sync(pendingVoucher(), undefined, true);
  assert.equal(result.voucher.status, "valid");
  assert.equal(result.voucher.payment_id, "456");
});

await test("deduplicates simultaneous screens and limits concurrency to three vouchers", async () => {
  let active = 0;
  let peak = 0;
  const ids: string[] = [];
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sync = createVoucherPaymentSync({
    getPayment: async (id) => {
      ids.push(id);
      active += 1;
      peak = Math.max(peak, active);
      await gate;
      active -= 1;
      return null;
    },
    searchPayments: async () => [],
    confirmPayment: async () => {
      assert.fail("must not confirm");
    },
    sendConversionEvents: async () => undefined,
    onError: () => undefined,
  });
  const vouchers = Array.from({ length: 10 }, (_, index) =>
    pendingVoucher({
      id: index + 1,
      code: `a${index}`,
      payment_id: String(index + 100),
    }),
  );
  const tasks = vouchers.map((voucher) => sync(voucher));
  tasks.push(sync(vouchers[0]!));
  await Promise.resolve();
  assert.equal(ids.length, 3);
  release?.();
  await Promise.all(tasks);
  assert.equal(ids.length, 10);
  assert.equal(peak, 3);
  assert.deepEqual(
    new Set(ids),
    new Set(vouchers.map((voucher) => voucher.payment_id)),
  );
  await sync(vouchers[0]!);
  assert.equal(ids.length, 10);
});

await test("does not query or reactivate terminal vouchers in a displayed page", async () => {
  const sync = createVoucherPaymentSync({
    getPayment: async () => {
      assert.fail("must not fetch");
    },
    searchPayments: async () => {
      assert.fail("must not search");
    },
    confirmPayment: async () => {
      assert.fail("must not confirm");
    },
    sendConversionEvents: async () => undefined,
    onError: () => undefined,
  });
  for (const status of ["valid", "redeemed", "used", "expired"]) {
    assert.equal(
      (await sync(pendingVoucher({ status }))).voucher.status,
      status,
    );
  }
});

await test("reloads only displayed ids, preserves order and isolates partial API failures", async () => {
  const page = [
    pendingVoucher({ id: 20 }),
    pendingVoucher({ id: 10, code: "b2c3" }),
  ];
  const calls: number[] = [];
  const result = await syncDisplayedVoucherPage(page, {
    sync: async (voucher) => {
      calls.push(voucher.id);
      return {
        voucher,
        payment: null,
        syncError: voucher.id === 10 ? "unavailable" : null,
      };
    },
    reload: async (ids) => {
      assert.deepEqual(ids, [20, 10]);
      return [
        page[1]!,
        { ...page[0]!, status: "valid", valid: true },
        pendingVoucher({ id: 999 }),
      ];
    },
  });
  assert.deepEqual(calls, [20, 10]);
  assert.deepEqual(
    result.items.map((voucher) => voucher.id),
    [20, 10],
  );
  assert.equal(result.items[0]?.status, "valid");
  assert.equal(result.items[1]?.status, "pending");
  assert.ok(result.syncWarning);
});

await test("page recovery does not restore deleted vouchers or load anything for an empty page", async () => {
  const result = await syncDisplayedVoucherPage([pendingVoucher()], {
    sync: async (voucher) => ({ voucher, payment: null, syncError: null }),
    reload: async () => [pendingVoucher({ deletedAt: new Date() })],
  });
  assert.deepEqual(result.items, []);
  const empty = await syncDisplayedVoucherPage([], {
    sync: async () => {
      assert.fail("must not sync");
    },
    reload: async () => {
      assert.fail("must not load");
    },
  });
  assert.deepEqual(empty, { items: [], syncWarning: null });
});
