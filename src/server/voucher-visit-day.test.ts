import type { Prisma, Voucher } from "@prisma/client";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { confirmVoucherPayment } from "./voucher-payment-confirmation.ts";
import { createVoucherPaymentSync } from "./voucher-payment-sync-core.ts";
import { pendingVoucher } from "./voucher-payment-test-fixtures.ts";
import { runVoucherMaintenance } from "./voucher-maintenance.ts";

// Visit date 30/09/2026 stored at 00:00 Brasília, as observed for voucher c33z.
const VISIT_MIDNIGHT = new Date("2026-09-30T03:00:00.000Z");

const payment: PaymentResponse = {
  api_response: { status: 200, headers: ["", []] },
  id: 181646542778,
  status: "approved",
  external_reference: "a1b2",
  transaction_amount: 50,
  currency_id: "BRL",
};

// Runs the real reconciliation wired to the real confirmation.
async function reconcile(
  initial: Voucher,
  options: { paymentId?: string } = {},
) {
  let voucher = initial;
  let conversions = 0;
  const sync = createVoucherPaymentSync({
    getPayment: async () => payment,
    searchPayments: async () => [
      { id: "181646542778", status: "approved", externalReference: "a1b2" },
    ],
    confirmPayment: (input) =>
      confirmVoucherPayment(input, {
        findVoucher: async () => voucher,
        updateMany: async ({ where, data }: Prisma.VoucherUpdateManyArgs) => {
          if (where?.status !== voucher.status || voucher.deletedAt)
            return { count: 0 };
          voucher = {
            ...voucher,
            payment_id:
              typeof data.payment_id === "string"
                ? data.payment_id
                : voucher.payment_id,
            status:
              typeof data.status === "string" ? data.status : voucher.status,
            valid:
              typeof data.valid === "boolean" ? data.valid : voucher.valid,
          };
          return { count: 1 };
        },
      }),
    sendConversionEvents: async () => {
      conversions += 1;
    },
    onError: () => undefined,
  });
  await sync(voucher, options.paymentId, true);
  return { voucher, conversions };
}

const visitDayInstants = [
  ["exact local midnight", "2026-09-30T03:00:00.000Z"],
  ["afternoon purchase", "2026-09-30T17:31:22.000Z"],
  ["last instant of the day", "2026-10-01T02:59:59.999Z"],
] as const;

for (const [label, instant] of visitDayInstants) {
  for (const storedPaymentId of [null, "181646542778"]) {
    await test(`confirms on the visit day (${label}, stored id ${storedPaymentId})`, async () => {
      mock.timers.enable({ apis: ["Date"], now: new Date(instant) });
      try {
        const result = await reconcile(
          pendingVoucher({
            payment_id: storedPaymentId,
            expires_at: VISIT_MIDNIGHT,
          }),
        );
        assert.equal(result.voucher.status, "valid");
        assert.equal(result.voucher.valid, true);
        assert.equal(result.voucher.payment_id, "181646542778");
        assert.equal(result.conversions, 1);
      } finally {
        mock.timers.reset();
      }
    });
  }
}

await test("confirms via explicit checkout-return payment id on the visit day", async () => {
  mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-09-30T17:31:22.000Z"),
  });
  try {
    const result = await reconcile(
      pendingVoucher({ payment_id: null, expires_at: VISIT_MIDNIGHT }),
      { paymentId: "181646542778" },
    );
    assert.equal(result.voucher.status, "valid");
  } finally {
    mock.timers.reset();
  }
});

await test("does not activate once Brasília passes to the next day", async () => {
  mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-10-01T03:00:00.000Z"),
  });
  try {
    const result = await reconcile(
      pendingVoucher({ payment_id: null, expires_at: VISIT_MIDNIGHT }),
    );
    assert.equal(result.voucher.status, "pending");
    assert.equal(result.voucher.valid, false);
    assert.equal(result.conversions, 0);
  } finally {
    mock.timers.reset();
  }
});

await test("confirms future and open-ended vouchers", async () => {
  mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-09-30T17:00:00.000Z"),
  });
  try {
    for (const expires_at of [new Date("2026-10-05T03:00:00.000Z"), null]) {
      const result = await reconcile(pendingVoucher({ expires_at }));
      assert.equal(result.voucher.status, "valid");
    }
  } finally {
    mock.timers.reset();
  }
});

// Maintenance: capture the filter sent to the database and apply it to rows.
type Row = { id: string; expires_at: Date };
const rows: Row[] = [
  { id: "yesterday", expires_at: new Date("2026-09-29T03:00:00.000Z") },
  { id: "today", expires_at: VISIT_MIDNIGHT },
  { id: "tomorrow", expires_at: new Date("2026-10-01T03:00:00.000Z") },
];

async function selectedByMaintenance(now: Date) {
  const selected: string[][] = [];
  await runVoucherMaintenance(async ({ where }) => {
    const lt = (where?.expires_at as { lt: Date }).lt;
    selected.push(rows.filter((r) => r.expires_at < lt).map((r) => r.id));
    return { count: 0 };
  }, now);
  return selected;
}

await test("maintenance spares today's vouchers until Brasília midnight", async () => {
  for (const now of ["2026-09-30T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]) {
    assert.deepEqual(await selectedByMaintenance(new Date(now)), [
      ["yesterday"],
      ["yesterday"],
    ]);
  }
  assert.deepEqual(
    await selectedByMaintenance(new Date("2026-10-01T03:00:00.000Z")),
    [
      ["yesterday", "today"],
      ["yesterday", "today"],
    ],
  );
});

await test("maintenance keeps status filters and soft-delete timestamp", async () => {
  const calls: Prisma.VoucherUpdateManyArgs[] = [];
  const now = new Date("2026-10-01T10:00:00.000Z");
  const result = await runVoucherMaintenance(async (args) => {
    calls.push(args);
    return { count: 2 };
  }, now);
  assert.deepEqual(result, { expiredVouchers: 2, softDeletedPendingVouchers: 2 });
  assert.equal(calls[0]?.where?.status, "valid");
  assert.deepEqual(calls[0]?.data, { valid: false, status: "expired" });
  assert.equal(calls[1]?.where?.status, "pending");
  assert.equal(calls[1]?.where?.deletedAt, null);
  assert.deepEqual(calls[1]?.data, { deletedAt: now });
});
