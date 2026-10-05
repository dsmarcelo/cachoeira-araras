/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import { getSaoPauloDateKey } from "../src/lib/utils/date";
import type * as adapter from "./lib/mercadopagoOperations";
import { createMercadoPagoFake } from "./testing/mercadopagoFake";
import { createConvexTest } from "./test.setup";

let fake: ReturnType<typeof createMercadoPagoFake>;
vi.mock("./lib/mercadopagoOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof adapter>()),
  findChargebacksByPayment: (paymentId: string) =>
    fake.api.findChargebacksByPayment(paymentId),
  searchPaymentsUpdatedBetween: (beginMs: number, endMs: number) =>
    fake.api.searchPaymentsUpdatedBetween(beginMs, endMs),
}));

const today = getSaoPauloDateKey();

beforeEach(() => {
  fake = createMercadoPagoFake();
});
afterEach(() => {
  vi.useRealTimers();
});

function voucherDoc(code: string, status: "redeemed" | "expired") {
  return {
    code,
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status,
    visitDate: today,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    preferenceId: `pref-${code}`,
    paymentId: `pay-${code}`,
    isTest: false,
    purchasedAt: Date.now(),
  };
}

function payment(
  code: string | null,
  status: string,
  dateLastUpdated = Date.now() - 1000,
) {
  fake.payments.set(`pay-${code ?? "orphan"}`, {
    id: `pay-${code ?? "orphan"}`,
    status,
    externalReference: code,
    amount: 50,
    refundedAmount: status === "refunded" ? 50 : 0,
    refundedCents: status === "refunded" ? 5000 : undefined,
    dateLastUpdated,
  });
}

async function settle(t: ReturnType<typeof createConvexTest>) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

/** Seeds a paid voucher and its summary, as a real purchase would have. */
async function seed(t: ReturnType<typeof createConvexTest>, code: string) {
  await t.run((ctx) => ctx.db.insert("vouchers", voucherDoc(code, "redeemed")));
  await t.mutation(internal.finance.recomputeDay, {
    date: today,
  });
}

const summary = (t: ReturnType<typeof createConvexTest>) =>
  t.run((ctx) =>
    ctx.db
      .query("financeDays")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique(),
  );

test("a redeemed voucher whose payment was refunded gets a reversal and leaves the finance day", async () => {
  const t = createConvexTest();
  await seed(t, "RED01");
  expect(await summary(t)).not.toBeNull();
  payment("RED01", "refunded");

  const result = await t.action(internal.paymentSweep.sweepRecentPayments, {});
  await settle(t);

  expect(result).toEqual({ scanned: 1, synced: 1, skipped: 0 });
  const voucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "RED01"))
      .unique(),
  );
  // A redeemed voucher keeps its status and records the reversal.
  expect(voucher?.status).toBe("redeemed");
  expect(voucher?.reversal?.reason).toBe("refunded");
  expect(await summary(t)).toBeNull();
});

test("an expired voucher whose payment was refunded is reversed too", async () => {
  const t = createConvexTest();
  await t.run((ctx) =>
    ctx.db.insert("vouchers", voucherDoc("EXP01", "expired")),
  );
  payment("EXP01", "refunded");

  await t.action(internal.paymentSweep.sweepRecentPayments, {});

  const voucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "EXP01"))
      .unique(),
  );
  expect(voucher?.status).toBe("expired");
  expect(voucher?.reversal?.reason).toBe("refunded");
});

test("payments with no reference, an unknown voucher, or an old update are skipped", async () => {
  const t = createConvexTest();
  payment(null, "approved");
  payment("GONE1", "refunded");
  payment("OLD01", "refunded", Date.now() - 3 * 24 * 60 * 60 * 1000);

  const result = await t.action(internal.paymentSweep.sweepRecentPayments, {});

  expect(result).toEqual({ scanned: 2, synced: 0, skipped: 2 });
});

test("an incomplete scan throws and changes nothing", async () => {
  const t = createConvexTest();
  await seed(t, "RED01");
  payment("RED01", "refunded");
  fake.failNext("search");

  await expect(
    t.action(internal.paymentSweep.sweepRecentPayments, {}),
  ).rejects.toThrow("Incomplete payment search");

  const voucher = await t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "RED01"))
      .unique(),
  );
  expect(voucher?.status).toBe("redeemed");
  expect(voucher?.reversal).toBeUndefined();
});

test("a payment that fails to sync does not stop the others, but the run fails", async () => {
  const t = createConvexTest();
  await seed(t, "RED01");
  await t.run((ctx) =>
    ctx.db.insert("vouchers", voucherDoc("RED02", "redeemed")),
  );
  payment("RED01", "charged_back");
  payment("RED02", "refunded");
  fake.failNext("chargebacks");

  await expect(
    t.action(internal.paymentSweep.sweepRecentPayments, {}),
  ).rejects.toThrow("1 of 2 payments failed");

  const reversal = async (code: string) =>
    (
      await t.run((ctx) =>
        ctx.db
          .query("vouchers")
          .withIndex("by_code", (q) => q.eq("code", code))
          .unique(),
      )
    )?.reversal;
  expect(await reversal("RED01")).toBeUndefined();
  expect(await reversal("RED02")).toBeDefined();
});
