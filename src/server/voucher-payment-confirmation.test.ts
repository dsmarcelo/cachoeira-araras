import type { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { pendingVoucher } from "./voucher-payment-test-fixtures.ts";
import { confirmVoucherPayment } from "./voucher-payment-confirmation.ts";

await test("records payment without activating a pending voucher whose expiry has passed", async () => {
  let voucher = pendingVoucher({
    payment_id: null,
    expires_at: new Date("2000-01-01T00:00:00Z"),
  });
  const result = await confirmVoucherPayment(
    { code: voucher.code, paymentId: "123", paymentStatus: "approved" },
    {
      findVoucher: async () => voucher,
      updateMany: async ({ data }) => {
        voucher = {
          ...voucher,
          payment_id:
            typeof data.payment_id === "string" ? data.payment_id : voucher.payment_id,
          status:
            typeof data.status === "string" ? data.status : voucher.status,
          valid: typeof data.valid === "boolean" ? data.valid : voucher.valid,
        };
        return { count: 1 };
      },
    },
  );
  assert.equal(result.voucher?.payment_id, "123");
  assert.equal(result.voucher?.status, "pending");
  assert.equal(result.voucher?.valid, false);
  const repeated = await confirmVoucherPayment(
    { code: voucher.code, paymentId: "123", paymentStatus: "approved" },
    {
      findVoucher: async () => voucher,
      updateMany: async () => {
        assert.fail("must not repeatedly record the same expired payment");
      },
    },
  );
  assert.equal(repeated.shouldSendConversionEvents, false);
});

await test("approves a pending voucher with an already recorded payment id", async () => {
  let voucher = pendingVoucher();
  const result = await confirmVoucherPayment(
    { code: voucher.code, paymentId: "123", paymentStatus: "approved" },
    {
      findVoucher: async () => voucher,
      updateMany: async ({ where, data }) => {
        if (where?.payment_id === null && voucher.payment_id !== null)
          return { count: 0 };
        if (where?.status !== voucher.status) return { count: 0 };
        voucher = {
          ...voucher,
          status:
            typeof data.status === "string" ? data.status : voucher.status,
          valid: data.valid === true,
        };
        return { count: 1 };
      },
    },
  );
  assert.equal(result.voucher?.status, "valid");
  assert.equal(result.shouldSendConversionEvents, true);
});

await test("concurrent approval confirms once and cannot overwrite redemption", async () => {
  let voucher = pendingVoucher();
  let writes = 0;
  const dependencies = {
    findVoucher: async () => ({ ...voucher }),
    updateMany: async ({ where, data }: Prisma.VoucherUpdateManyArgs) => {
      if (
        where?.status !== voucher.status ||
        where.payment_id !== voucher.payment_id ||
        voucher.deletedAt
      )
        return { count: 0 };
      writes += 1;
      voucher = {
        ...voucher,
        status: typeof data.status === "string" ? data.status : voucher.status,
        valid: data.valid === true,
      };
      return { count: 1 };
    },
  };
  const input = { code: "a1b2", paymentId: "123", paymentStatus: "approved" };
  const results = await Promise.all([
    confirmVoucherPayment(input, dependencies),
    confirmVoucherPayment(input, dependencies),
  ]);
  assert.equal(writes, 1);
  assert.equal(
    results.filter((result) => result.shouldSendConversionEvents).length,
    1,
  );
  voucher = { ...voucher, status: "redeemed", valid: false };
  const redeemed = await confirmVoucherPayment(input, dependencies);
  assert.equal(redeemed.voucher?.status, "redeemed");
  assert.equal(redeemed.shouldSendConversionEvents, false);
  assert.equal(writes, 1);
});

for (const status of ["used", "redeemed", "expired", "valid"]) {
  await test(`does not reactivate ${status} vouchers`, async () => {
    const voucher = pendingVoucher({ status, valid: false });
    const result = await confirmVoucherPayment(
      { code: voucher.code, paymentId: "123", paymentStatus: "approved" },
      {
        findVoucher: async () => voucher,
        updateMany: async () => {
          assert.fail("must not update");
        },
      },
    );
    assert.equal(result.voucher?.status, status);
    assert.equal(result.voucher?.valid, false);
    assert.equal(result.shouldSendConversionEvents, false);
  });
}

await test("does not confirm deleted vouchers", async () => {
  const result = await confirmVoucherPayment(
    { code: "a1b2", paymentId: "123", paymentStatus: "approved" },
    {
      findVoucher: async () => pendingVoucher({ deletedAt: new Date() }),
      updateMany: async () => {
        assert.fail("must not update");
      },
    },
  );
  assert.equal(result.outcome, "not_found");
});
