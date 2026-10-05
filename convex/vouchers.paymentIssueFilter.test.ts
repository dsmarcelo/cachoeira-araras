/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { patchVoucher } from "./lib/voucherWrites";
import { voucherSearchText } from "./lib/voucherSearch";
import { createConvexTest, withAuth } from "./test.setup";

const firstPage = { numItems: 50, cursor: null };

async function insertVoucher(
  t: ReturnType<typeof createConvexTest>,
  code: string,
  overrides: Partial<Doc<"vouchers">> = {},
) {
  const voucher = {
    code,
    name: `Visitante ${code}`,
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as const,
    visitDate: getSaoPauloDateKey(),
    expiresAt: Date.now() + 86_400_000,
    preferenceId: `pref-${code}`,
    paymentId: `pay-${code}`,
    isTest: false,
    purchasedAt: Date.now(),
    ...overrides,
  };
  return t.run((ctx) =>
    ctx.db.insert("vouchers", {
      ...voucher,
      searchText: voucherSearchText(voucher),
      isActive: voucher.deletedAt === undefined && !voucher.isTest,
    }),
  );
}

const dispute = {
  kind: "dispute" as const,
  status: "in_mediation",
  notedAt: 1_000,
};

/** Applies a patch the way production code does, through `patchVoucher`. */
async function patch(
  t: ReturnType<typeof createConvexTest>,
  code: string,
  changes: Parameters<typeof patchVoucher>[2],
) {
  await t.run(async (ctx) => {
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!voucher) throw new Error("missing voucher");
    await patchVoucher(ctx, voucher, changes);
  });
}

const disputedCodes = async (
  asAdmin: Awaited<ReturnType<typeof withAuth>>,
  extra: { search?: string; status?: Doc<"vouchers">["status"] } = {},
) =>
  (
    await asAdmin.query(api.vouchers.listAdmin, {
      paginationOpts: firstPage,
      paymentDisputed: true,
      ...extra,
    })
  ).page.map((voucher) => voucher.code);

test("patchVoucher derives paymentDisputed from paymentIssue set and clear", async () => {
  const t = createConvexTest();
  const id = await insertVoucher(t, "a1b2");
  const read = () => t.run((ctx) => ctx.db.get("vouchers", id));

  await patch(t, "a1b2", { paymentIssue: dispute });
  expect((await read())?.paymentDisputed).toBe(true);

  // An unrelated patch leaves the flag alone.
  await patch(t, "a1b2", { name: "Outro nome" });
  expect((await read())?.paymentDisputed).toBe(true);

  await patch(t, "a1b2", {
    paymentIssue: { kind: "partial_refund", status: "approved", notedAt: 2 },
  });
  expect((await read())?.paymentDisputed).toBeUndefined();

  await patch(t, "a1b2", { paymentIssue: dispute });
  await patch(t, "a1b2", { paymentIssue: undefined });
  const cleared = await read();
  expect(cleared?.paymentDisputed).toBeUndefined();
  expect(cleared?.paymentIssue).toBeUndefined();
});

test("the paymentDisputed filter returns only disputed live vouchers", async () => {
  const t = createConvexTest();
  await insertVoucher(t, "clea");
  await insertVoucher(t, "part");
  await insertVoucher(t, "disp", { status: "redeemed" });
  await insertVoucher(t, "dsp2", { purchasedAt: Date.now() - 1_000 });
  await insertVoucher(t, "dele", { deletedAt: Date.now() });
  await insertVoucher(t, "test", { isTest: true });
  await patch(t, "part", {
    paymentIssue: { kind: "partial_refund", status: "approved", notedAt: 2 },
  });
  for (const code of ["disp", "dsp2", "dele", "test"]) {
    await patch(t, code, { paymentIssue: dispute });
  }
  const asAdmin = await withAuth(t, "admin");

  // Newest sale first, straight from the index.
  expect(await disputedCodes(asAdmin)).toEqual(["disp", "dsp2"]);
  expect(await disputedCodes(asAdmin, { status: "redeemed" })).toEqual([
    "disp",
  ]);
  // Search path uses the search index filter field.
  expect(await disputedCodes(asAdmin, { search: "dsp2" })).toEqual(["dsp2"]);
  expect(await disputedCodes(asAdmin, { search: "clea" })).toEqual([]);

  await patch(t, "disp", { paymentIssue: undefined });
  expect(await disputedCodes(asAdmin)).toEqual(["dsp2"]);
});
