/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";

import { addDaysToDateKey, getSaoPauloDateKey } from "../src/lib/utils/date";
import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";

const today = getSaoPauloDateKey();
const reversedMessage = "estornado";

type Status = "valid" | "redeemed" | "expired" | "refunded";

/** Inserts voucher "abcd" (with a payment reversal by default). */
async function setup(status: Status, reversal = true) {
  const t = createConvexTest();
  await t.run((ctx) =>
    ctx.db.insert("vouchers", {
      code: "abcd",
      name: "Visitante Teste",
      phone: "11999999999",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status,
      visitDate: today,
      expiresAt: Date.now() - 60_000,
      lookupToken: "3f8c2a4e-7b1d-4c5a-9e2f-6a1b8c0d4e7f",
      preferenceId: "pref-1",
      isTest: false,
      paymentId: "pay-1",
      ...(reversal
        ? { reversal: { reason: "refunded", notedAt: Date.now() } }
        : {}),
    }),
  );
  return t;
}

const read = (t: Awaited<ReturnType<typeof setup>>) =>
  t.run((ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "abcd"))
      .unique(),
  );

describe("staff cannot undo a payment reversal", () => {
  test.each(["expired", "redeemed"] as const)(
    "reactivate refuses a reversed %s voucher",
    async (status) => {
      const t = await setup(status);
      const asEmployee = await withAuth(t, "employee");
      await expect(
        asEmployee.mutation(api.vouchers.reactivate, { code: "abcd" }),
      ).rejects.toThrow(reversedMessage);
      const stored = await read(t);
      expect(stored?.status).toBe(status);
      expect(stored?.reversal).toBeDefined();
    },
  );

  test("rescheduleByAdmin refuses a reversed expired voucher", async () => {
    const t = await setup("expired");
    const asAdmin = await withAuth(t, "admin");
    const before = await read(t);
    await expect(
      asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
        code: "abcd",
        visitDate: addDaysToDateKey(today, 3),
      }),
    ).rejects.toThrow(reversedMessage);
    const stored = await read(t);
    expect(stored?.status).toBe("expired");
    expect(stored?.visitDate).toBe(before?.visitDate);
    expect(stored?.expiresAt).toBe(before?.expiresAt);
  });

  test.each(["expired", "redeemed", "refunded"] as const)(
    "updateStatus refuses moving a reversed %s voucher to valid",
    async (status) => {
      const t = await setup(status);
      const asAdmin = await withAuth(t, "admin");
      await expect(
        asAdmin.mutation(api.vouchers.updateStatus, {
          code: "abcd",
          status: "valid",
        }),
      ).rejects.toThrow(reversedMessage);
      expect((await read(t))?.status).toBe(status);
    },
  );

  test("updateStatus refuses moving a legacy refunded voucher without a reversal to valid", async () => {
    const t = await setup("refunded", false);
    const asAdmin = await withAuth(t, "admin");
    await expect(
      asAdmin.mutation(api.vouchers.updateStatus, {
        code: "abcd",
        status: "valid",
      }),
    ).rejects.toThrow(reversedMessage);
    expect((await read(t))?.status).toBe("refunded");
  });

  test("an unreversed expired voucher can still be reactivated", async () => {
    const t = await setup("expired", false);
    const asEmployee = await withAuth(t, "employee");
    await asEmployee.mutation(api.vouchers.reactivate, { code: "abcd" });
    expect((await read(t))?.status).toBe("valid");
  });
});
