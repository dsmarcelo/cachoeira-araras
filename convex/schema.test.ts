/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { countsAsRealVoucher } from "./vouchers";

const modules = import.meta.glob("./**/*.ts");

function baseVoucher() {
  return {
    code: "ABC123",
    name: "Maria Silva",
    phone: "5511999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 0,
    elderlyPool: 0,
    priceCents: 5000,
    status: "pending" as const,
    visitDate: "2026-09-10",
    expiresAt: Date.parse("2026-09-10T23:59:59.000Z"),
    preferenceId: "pref-1",
    isTest: false,
  };
}

test("a voucher can be written and read back with visitDate and expiresAt independently set", async () => {
  const t = convexTest(schema, modules);

  const id = await t.run(async (ctx) => {
    return await ctx.db.insert("vouchers", baseVoucher());
  });

  const stored = await t.run(async (ctx) => ctx.db.get(id));

  expect(stored?.visitDate).toBe("2026-09-10");
  expect(stored?.expiresAt).toBe(Date.parse("2026-09-10T23:59:59.000Z"));
  expect(stored?.priceCents).toBe(5000);
  expect(Number.isInteger(stored?.priceCents)).toBe(true);
});

test("reactivating a voucher moves expiresAt without touching visitDate", async () => {
  const t = convexTest(schema, modules);

  const id = await t.run(async (ctx) => ctx.db.insert("vouchers", baseVoucher()));

  const newExpiry = Date.parse("2026-09-11T23:59:59.000Z");
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { status: "valid", expiresAt: newExpiry });
  });

  const reactivated = await t.run(async (ctx) => ctx.db.get(id));
  expect(reactivated?.expiresAt).toBe(newExpiry);
  expect(reactivated?.visitDate).toBe("2026-09-10");
});

test("a voucher can carry an embedded referrer and be soft-deleted", async () => {
  const t = convexTest(schema, modules);

  const id = await t.run(async (ctx) =>
    ctx.db.insert("vouchers", {
      ...baseVoucher(),
      code: "REF123",
      referrer: { source: "instagram", url: "https://instagram.com/x" },
    }),
  );

  const withReferrer = await t.run(async (ctx) => ctx.db.get(id));
  expect(withReferrer?.referrer).toEqual({
    source: "instagram",
    url: "https://instagram.com/x",
  });

  const deletedAt = Date.now();
  await t.run(async (ctx) => ctx.db.patch(id, { deletedAt }));
  const softDeleted = await t.run(async (ctx) => ctx.db.get(id));
  expect(softDeleted?.deletedAt).toBe(deletedAt);
});

test("a Test Voucher can be written and read back by code", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) =>
    ctx.db.insert("vouchers", {
      ...baseVoucher(),
      code: "TEST01",
      priceCents: 1,
      isTest: true,
    }),
  );

  const found = await t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "TEST01"))
      .unique(),
  );

  expect(found?.isTest).toBe(true);
  expect(found?.priceCents).toBe(1);
});

test("countsAsRealVoucher excludes soft-deleted and Test Vouchers", () => {
  expect(countsAsRealVoucher({ deletedAt: undefined, isTest: false })).toBe(
    true,
  );
  expect(countsAsRealVoucher({ deletedAt: Date.now(), isTest: false })).toBe(
    false,
  );
  expect(countsAsRealVoucher({ deletedAt: undefined, isTest: true })).toBe(
    false,
  );
  expect(countsAsRealVoucher({ deletedAt: Date.now(), isTest: true })).toBe(
    false,
  );
});

test("settings store one document per key, in every value shape the domain uses", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    await ctx.db.insert("settings", {
      key: "voucher.price",
      value: 50,
      updatedBy: "admin@example.com",
    });
    await ctx.db.insert("settings", {
      key: "disabled.days",
      value: ["2026-12-25", "2027-01-01"],
    });
    await ctx.db.insert("settings", {
      key: "enable.voucher.buy",
      value: true,
    });
    await ctx.db.insert("settings", {
      key: "top.message",
      value: "Bem-vindo!",
    });
  });

  const price = await t.run(async (ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "voucher.price"))
      .unique(),
  );
  expect(price?.value).toBe(50);
  expect(price?.updatedBy).toBe("admin@example.com");

  const disabledDays = await t.run(async (ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "disabled.days"))
      .unique(),
  );
  expect(disabledDays?.value).toEqual(["2026-12-25", "2027-01-01"]);

  const enableBuy = await t.run(async (ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "enable.voucher.buy"))
      .unique(),
  );
  expect(enableBuy?.value).toBe(true);
});
