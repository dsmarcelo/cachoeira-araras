/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { generateVoucherCode } from "./lib/voucherCode";
import { VOUCHER_LOOKUP_BURST_LIMIT } from "./lib/rateLimiter";
import { createConvexTest } from "./test.setup";

function baseVoucher(
  overrides: Partial<{ deletedAt: number } & ReturnType<typeof defaults>> = {},
) {
  return { ...defaults(), ...overrides };
}

function defaults() {
  return {
    code: "a1b2",
    name: "Visitante Teste",
    phone: "11999999999",
    adults: 2,
    elderly: 0,
    adultsPool: 2,
    elderlyPool: 0,
    priceCents: 5000,
    status: "valid" as const,
    visitDate: "2026-09-10",
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    preferenceId: "pref-1",
    isTest: false,
    deletedAt: undefined as number | undefined,
  };
}

async function insertVoucher(
  t: ReturnType<typeof createConvexTest>,
  voucher: ReturnType<typeof baseVoucher>,
) {
  return t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
}

test("an anonymous Voucher Code lookup authorizes reactive access to only that Voucher", async () => {
  const t = createConvexTest();
  const voucher = baseVoucher();
  const id = await insertVoucher(t, voucher);
  const stored = await t.run((ctx) => ctx.db.get("vouchers", id));

  const authorization = await t.mutation(api.vouchers.authorizeLookup, {
    code: "a1b2",
  });

  expect(authorization).toMatchObject({
    kind: "authorized",
    voucher: {
      code: "a1b2",
      createdAt: stored!._creationTime,
      status: "valid",
      visitDate: "2026-09-10",
      expiresAt: voucher.expiresAt,
      adults: 2,
      elderly: 0,
      adultsPool: 2,
      elderlyPool: 0,
      priceCents: 5000,
    },
  });
  if (authorization.kind !== "authorized") {
    throw new Error("Expected lookup authorization");
  }

  const monitored = await t.query(api.vouchers.getAuthorized, {
    lookupToken: authorization.lookupToken,
  });
  expect(monitored).toEqual(authorization.voucher);
});

test("an authorized status subscription keeps working after lookup attempts are exhausted", async () => {
  const t = createConvexTest();
  await insertVoucher(t, baseVoucher());

  const authorization = await t.mutation(api.vouchers.authorizeLookup, {
    code: "a1b2",
  });
  if (authorization.kind !== "authorized") {
    throw new Error("Expected lookup authorization");
  }

  for (let attempt = 1; attempt < VOUCHER_LOOKUP_BURST_LIMIT; attempt += 1) {
    const result = await t.mutation(api.vouchers.authorizeLookup, {
      code: `missing-${attempt}`,
    });
    expect(result.kind).toBe("not_found");
  }

  const blocked = await t.mutation(api.vouchers.authorizeLookup, {
    code: "one-attempt-too-many",
  });
  expect(blocked).toMatchObject({ kind: "rate_limited" });

  await t.run(async (ctx) => {
    const stored = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", "a1b2"))
      .unique();
    if (!stored) throw new Error("Voucher fixture missing");
    await ctx.db.patch("vouchers", stored._id, { status: "redeemed" });
  });

  const monitored = await t.query(api.vouchers.getAuthorized, {
    lookupToken: authorization.lookupToken,
  });
  expect(monitored?.status).toBe("redeemed");
});

test("unknown and soft-deleted Voucher Codes consume lookup capacity without granting access", async () => {
  const t = createConvexTest();
  await insertVoucher(
    t,
    baseVoucher({ code: "gone", deletedAt: Date.now() }),
  );

  await expect(
    t.mutation(api.vouchers.authorizeLookup, { code: "zzzz" }),
  ).resolves.toEqual({ kind: "not_found" });
  await expect(
    t.mutation(api.vouchers.authorizeLookup, { code: "gone" }),
  ).resolves.toEqual({ kind: "not_found" });
});

test("a Test Voucher can be authorized by its Voucher Code", async () => {
  const t = createConvexTest();
  await insertVoucher(t, baseVoucher({ code: "test", isTest: true }));

  const result = await t.mutation(api.vouchers.authorizeLookup, {
    code: "test",
  });
  expect(result).toMatchObject({
    kind: "authorized",
    voucher: { code: "test", status: "valid" },
  });
});

test("the public lookup surface exposes neither buyer data nor a direct arbitrary-code query", async () => {
  const t = createConvexTest();
  await insertVoucher(t, baseVoucher());

  const result = await t.mutation(api.vouchers.authorizeLookup, {
    code: "a1b2",
  });
  if (result.kind !== "authorized") {
    throw new Error("Expected lookup authorization");
  }

  expect(result.voucher).not.toHaveProperty("_id");
  expect(result.voucher).not.toHaveProperty("name");
  expect(result.voucher).not.toHaveProperty("phone");
  expect(result.voucher).not.toHaveProperty("preferenceId");
  expect(result.voucher).not.toHaveProperty("paymentId");
  expect(result.lookupToken).not.toContain("a1b2");
  expect("getByCode" in api.vouchers).toBe(false);

  await expect(
    t.query(api.vouchers.getAuthorized, {
      lookupToken: crypto.randomUUID(),
    }),
  ).resolves.toBeNull();
});

test("a legacy four-character Voucher Code keeps resolving alongside new six-character codes", async () => {
  const t = createConvexTest();
  const newCode = generateVoucherCode();
  expect(newCode).toHaveLength(6);

  await insertVoucher(t, baseVoucher({ code: "a1b2" }));
  await insertVoucher(t, baseVoucher({ code: newCode, phone: "11988888888" }));

  const legacy = await t.mutation(api.vouchers.authorizeLookup, {
    code: "a1b2",
  });
  const current = await t.mutation(api.vouchers.authorizeLookup, {
    code: newCode,
  });

  expect(legacy).toMatchObject({ kind: "authorized", voucher: { code: "a1b2" } });
  expect(current).toMatchObject({
    kind: "authorized",
    voucher: { code: newCode },
  });
});
