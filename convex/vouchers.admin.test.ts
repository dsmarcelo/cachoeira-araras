/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { getSaoPauloDateKey } from "../src/lib/utils/date";
import { api } from "./_generated/api";
import { voucherSearchText } from "./lib/voucherSearch";
import { createConvexTest, withAuth } from "./test.setup";

const today = getSaoPauloDateKey();

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as
      | "pending"
      | "valid"
      | "redeemed"
      | "expired"
      | "refunded"
      | "cancelled",
    visitDate: today,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
    purchasedAt: Date.now(),
    deletedAt: undefined as number | undefined,
  };
}

async function insertVoucher(
  t: ReturnType<typeof createConvexTest>,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  const voucher = { ...defaults(), ...overrides };
  await t.run(async (ctx) =>
    ctx.db.insert("vouchers", {
      ...voucher,
      searchText: voucherSearchText(voucher),
      isActive: voucher.deletedAt === undefined && !voucher.isTest,
    }),
  );
  return voucher;
}

const firstPage = { numItems: 50, cursor: null };

const codesOf = (result: { page: { code: string }[] }) =>
  result.page.map((voucher) => voucher.code);

test("the admin list pages newest purchase first and continues from the cursor", async () => {
  const t = createConvexTest();
  for (const [i, code] of ["a", "b", "c", "d", "e"].entries()) {
    await insertVoucher(t, { code, purchasedAt: 1_000 + i });
  }
  const asAdmin = await withAuth(t, "admin");

  const first = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: { numItems: 2, cursor: null },
  });
  const second = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  const third = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: { numItems: 2, cursor: second.continueCursor },
  });

  expect(codesOf(first)).toEqual(["e", "d"]);
  expect(codesOf(second)).toEqual(["c", "b"]);
  expect(codesOf(third)).toEqual(["a"]);
  expect(third.isDone).toBe(true);
});

test("the admin list excludes Test Vouchers", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "real", name: "Ana" });
  await insertVoucher(t, { code: "test", name: "Beto", isTest: true });
  const asAdmin = await withAuth(t, "admin");

  const list = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
  });
  const searched = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    search: "beto",
  });

  expect(codesOf(list)).toEqual(["real"]);
  expect(searched.page).toEqual([]);
});

test("the admin list narrows by status", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "a", status: "valid" });
  await insertVoucher(t, { code: "b", status: "pending" });
  const asAdmin = await withAuth(t, "admin");

  const list = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    status: "pending",
  });

  expect(codesOf(list)).toEqual(["b"]);
});

test("the admin list narrows by purchase-date range, with or without a status", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "early", purchasedAt: 1_000, status: "valid" });
  await insertVoucher(t, { code: "mid", purchasedAt: 2_000, status: "valid" });
  await insertVoucher(t, { code: "late", purchasedAt: 3_000, status: "pending" });
  const asAdmin = await withAuth(t, "admin");

  const bounded = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    purchasedFrom: 1_500,
    purchasedTo: 2_500,
  });
  const fromOnly = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    purchasedFrom: 2_000,
  });
  const toOnlyWithStatus = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    purchasedTo: 2_500,
    status: "valid",
  });

  expect(codesOf(bounded)).toEqual(["mid"]);
  expect(codesOf(fromOnly)).toEqual(["late", "mid"]);
  expect(codesOf(toOnlyWithStatus)).toEqual(["mid", "early"]);
});

test("the admin list narrows by expiry range", async () => {
  const t = createConvexTest();
  const day = 1000 * 60 * 60 * 24;
  const base = Date.now() + 10 * day;
  await insertVoucher(t, { code: "early", expiresAt: base });
  await insertVoucher(t, { code: "mid", expiresAt: base + 2 * day });
  await insertVoucher(t, { code: "late", expiresAt: base + 4 * day });
  const asAdmin = await withAuth(t, "admin");

  const bounded = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    expiresAfter: base + day,
    expiresBefore: base + 3 * day,
  });
  const openEnded = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    expiresAfter: base + 2 * day,
  });

  expect(codesOf(bounded)).toEqual(["mid"]);
  expect(codesOf(openEnded).sort()).toEqual(["late", "mid"]);
});

test("the admin list searches by name, code and phone ignoring case and accents, and combines with filters", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "k7m2p9", name: "José Conceição", phone: "11988887777" });
  await insertVoucher(t, { code: "zzzzzz", name: "Maria Souza", phone: "21955554444", status: "pending" });
  const asAdmin = await withAuth(t, "admin");
  const search = async (
    text: string,
    extra: { status?: "pending" | "valid"; purchasedFrom?: number } = {},
  ) =>
    codesOf(
      await asAdmin.query(api.vouchers.listAdmin, {
        paginationOpts: firstPage,
        search: text,
        ...extra,
      }),
    );

  expect(await search("JOSE")).toEqual(["k7m2p9"]);
  expect(await search("conceicao")).toEqual(["k7m2p9"]);
  expect(await search("k7m2")).toEqual(["k7m2p9"]);
  expect(await search("2195555")).toEqual(["zzzzzz"]);
  expect(await search("maria", { status: "valid" })).toEqual([]);
  expect(await search("maria", { status: "pending" })).toEqual(["zzzzzz"]);
  expect(await search("maria", { purchasedFrom: Date.now() + 60_000 })).toEqual([]);
});

test("a search longer than the limit is refused with a readable message", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");

  await expect(
    asAdmin.query(api.vouchers.listAdmin, {
      paginationOpts: firstPage,
      search: "x".repeat(65),
    }),
  ).rejects.toThrow("no máximo 64 caracteres");
});

test("listPendingCodes returns only live, real pending vouchers", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "p1", status: "pending" });
  await insertVoucher(t, { code: "p2", status: "pending", isTest: true });
  await insertVoucher(t, { code: "p3", status: "pending", deletedAt: Date.now() });
  await insertVoucher(t, { code: "v1", status: "valid" });
  const asAdmin = await withAuth(t, "admin");

  expect(await asAdmin.query(api.vouchers.listPendingCodes, {})).toEqual(["p1"]);
});

test("an employee identity is rejected by every admin voucher function, including with a forged role argument", async () => {
  const t = createConvexTest();
  await insertVoucher(t);
  const asEmployee = await withAuth(t, "employee");
  // `role` isn't a real arg on any of these functions, but a caller could
  // still try to smuggle one in; Convex's arg validators reject an unknown
  // key like this outright, and the handlers never read a client-supplied
  // role in the first place.
  const forged = { role: "admin" } as unknown as Record<string, never>;
  const listArgs = { paginationOpts: firstPage, ...forged };

  await expect(
    asEmployee.query(api.vouchers.listAdmin, listArgs),
  ).rejects.toThrow();
  await expect(
    asEmployee.query(api.vouchers.listDeleted, listArgs),
  ).rejects.toThrow();
  await expect(
    asEmployee.query(api.vouchers.listPendingCodes, forged),
  ).rejects.toThrow();
  await expect(
    asEmployee.mutation(api.vouchers.updateStatus, {
      code: "a1b2",
      status: "expired",
      ...forged,
    }),
  ).rejects.toThrow();
  await expect(
    asEmployee.mutation(api.vouchers.restore, { code: "a1b2", ...forged }),
  ).rejects.toThrow();
});

test("a public caller is rejected by every admin voucher function", async () => {
  const t = createConvexTest();
  await insertVoucher(t);

  await expect(
    t.query(api.vouchers.listAdmin, { paginationOpts: firstPage }),
  ).rejects.toThrow();
  await expect(
    t.query(api.vouchers.listDeleted, { paginationOpts: firstPage }),
  ).rejects.toThrow();
  await expect(t.query(api.vouchers.listPendingCodes, {})).rejects.toThrow();
  await expect(
    t.mutation(api.vouchers.updateStatus, { code: "a1b2", status: "expired" }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.vouchers.restore, { code: "a1b2" }),
  ).rejects.toThrow();
});

test("editing a voucher's status persists it", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { status: "pending" });
  const asAdmin = await withAuth(t, "admin");

  await asAdmin.mutation(api.vouchers.updateStatus, {
    code: "a1b2",
    status: "valid",
  });

  const { page } = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
  });
  expect(page[0]?.status).toBe("valid");
});

test("an admin cannot move a cancelled voucher back into circulation", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { status: "cancelled" });
  const asAdmin = await withAuth(t, "admin");

  await expect(
    asAdmin.mutation(api.vouchers.updateStatus, {
      code: "a1b2",
      status: "valid",
    }),
  ).rejects.toThrow("terminal");
});

test("a soft-deleted voucher surfaces only in the deleted view until restored", async () => {
  const t = createConvexTest();
  await insertVoucher(t, { code: "a1b2", name: "Ana Lima", deletedAt: Date.now() });
  await insertVoucher(t, { code: "live", name: "Ana Souza" });
  const asAdmin = await withAuth(t, "admin");
  const active = () =>
    asAdmin.query(api.vouchers.listAdmin, { paginationOpts: firstPage });
  const deleted = (search?: string) =>
    asAdmin.query(api.vouchers.listDeleted, { paginationOpts: firstPage, search });

  expect(codesOf(await active())).toEqual(["live"]);
  expect(codesOf(await deleted())).toEqual(["a1b2"]);
  // Search in the deleted view only sees deleted vouchers.
  expect(codesOf(await deleted("ana"))).toEqual(["a1b2"]);

  await asAdmin.mutation(api.vouchers.restore, { code: "a1b2" });

  expect(codesOf(await active()).sort()).toEqual(["a1b2", "live"]);
  expect((await deleted()).page).toEqual([]);
  expect((await deleted("ana")).page).toEqual([]);
  const searched = await asAdmin.query(api.vouchers.listAdmin, {
    paginationOpts: firstPage,
    search: "lima",
  });
  expect(codesOf(searched)).toEqual(["a1b2"]);
});
