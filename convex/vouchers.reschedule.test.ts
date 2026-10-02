/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";

import {
  addDaysToDateKey,
  endOfSaoPauloDayMs,
  getSaoPauloDateKey,
} from "../src/lib/utils/date";
import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";

const today = getSaoPauloDateKey();
const inDays = (days: number) => addDaysToDateKey(today, days);

type Status =
  | "pending"
  | "valid"
  | "redeemed"
  | "expired"
  | "refunded"
  | "cancelled";

async function insertVoucher(
  t: ReturnType<typeof createConvexTest>,
  overrides: { status?: Status; visitDate?: string; deletedAt?: number } = {},
) {
  await t.run(async (ctx) =>
    ctx.db.insert("vouchers", {
      code: "abcd",
      name: "Visitante Teste",
      phone: "11999999999",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 5000,
      status: overrides.status ?? "valid",
      visitDate: overrides.visitDate ?? inDays(1),
      expiresAt: Date.now() + 60_000,
      preferenceId: "pref-1",
      isTest: false,
      deletedAt: overrides.deletedAt,
    }),
  );
}

const readVoucher = (t: ReturnType<typeof createConvexTest>) =>
  t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "abcd"))
      .unique(),
  );

const patchVoucher = (
  t: ReturnType<typeof createConvexTest>,
  patch: { status?: Status; deletedAt?: number },
) =>
  t.run(async (ctx) => {
    const voucher = await ctx.db.query("vouchers").first();
    await ctx.db.patch("vouchers", voucher!._id, patch);
  });

describe("rescheduleByAdmin", () => {
  test("moves the visit date and expiry to the end of the new day and records the admin", async () => {
    const t = createConvexTest();
    await insertVoucher(t);
    const asAdmin = await withAuth(t, "admin");
    const me = await asAdmin.query(api.auth.currentUser, {});

    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: inDays(400),
    });

    const voucher = await readVoucher(t);
    expect(voucher?.visitDate).toBe(inDays(400));
    expect(voucher?.expiresAt).toBe(endOfSaoPauloDayMs(inDays(400)));
    expect(voucher?.rescheduledBy).toEqual({
      kind: "admin",
      username: me?.username,
    });
    expect(voucher?.rescheduledAt).toBeTypeOf("number");
  });

  test("brings an Expired voucher back to Valid and keeps Pending as it is", async () => {
    const t = createConvexTest();
    await insertVoucher(t, { status: "expired", visitDate: inDays(-3) });
    const asAdmin = await withAuth(t, "admin");

    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: today,
    });
    expect((await readVoucher(t))?.status).toBe("valid");

    await patchVoucher(t, { status: "pending" });
    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: inDays(2),
    });
    expect((await readVoucher(t))?.status).toBe("pending");
  });

  test.each(["redeemed", "refunded", "cancelled"] as const)(
    "refuses a %s voucher",
    async (status) => {
      const t = createConvexTest();
      await insertVoucher(t, { status });
      const asAdmin = await withAuth(t, "admin");

      await expect(
        asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
          code: "abcd",
          visitDate: inDays(2),
        }),
      ).rejects.toThrow(/pendentes, válidos ou expirados/);
    },
  );

  test("refuses a deleted voucher and a past date", async () => {
    const t = createConvexTest();
    await insertVoucher(t, { deletedAt: Date.now() });
    const asAdmin = await withAuth(t, "admin");

    await expect(
      asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
        code: "abcd",
        visitDate: inDays(2),
      }),
    ).rejects.toThrow(/excluído/);

    await patchVoucher(t, { deletedAt: undefined });
    await expect(
      asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
        code: "abcd",
        visitDate: inDays(-1),
      }),
    ).rejects.toThrow(/passado/);
  });

  test("accepts a closed day and a day beyond the booking window", async () => {
    const t = createConvexTest();
    await insertVoucher(t);
    const asAdmin = await withAuth(t, "admin");
    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "disabled.days",
        value: [inDays(3)],
      });
    });

    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: inDays(3),
    });
    expect((await readVoucher(t))?.visitDate).toBe(inDays(3));

    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: inDays(400),
    });
    expect((await readVoucher(t))?.visitDate).toBe(inDays(400));
  });

  test("rejects employees and anonymous callers", async () => {
    const t = createConvexTest();
    await insertVoucher(t);
    const args = { code: "abcd", visitDate: inDays(2) };

    await expect(
      (await withAuth(t, "employee")).mutation(
        api.vouchers.rescheduleByAdmin,
        args,
      ),
    ).rejects.toThrow(/403/);
    await expect(
      t.mutation(api.vouchers.rescheduleByAdmin, args),
    ).rejects.toThrow(/401/);
  });

  test("a voucher rescheduled to today appears in the gate list and can be redeemed", async () => {
    const t = createConvexTest();
    await insertVoucher(t, { status: "expired", visitDate: inDays(-5) });
    const asAdmin = await withAuth(t, "admin");
    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: today,
    });

    const list = await asAdmin.query(api.vouchers.listToday, {});
    expect(list.map((v) => v.code)).toEqual(["abcd"]);
    await asAdmin.mutation(api.vouchers.redeemByCode, { code: "abcd" });
    expect((await readVoucher(t))?.status).toBe("redeemed");
  });

  test("the admin list exposes the reschedule audit fields", async () => {
    const t = createConvexTest();
    await insertVoucher(t);
    const asAdmin = await withAuth(t, "admin");
    await asAdmin.mutation(api.vouchers.rescheduleByAdmin, {
      code: "abcd",
      visitDate: inDays(2),
    });

    const [row] = await asAdmin.query(api.vouchers.listAdmin, {});
    expect(row?.visitDate).toBe(inDays(2));
    expect(row?.rescheduledBy?.kind).toBe("admin");
    expect(row?.rescheduledAt).toBeTypeOf("number");
  });
});
