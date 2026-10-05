/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { VOUCHER_LOOKUP_BURST_LIMIT } from "./lib/rateLimiter";
import { createConvexTest } from "./test.setup";

function voucherFixture(
  overrides: Partial<{
    code: string;
    phone: string;
    deletedAt: number;
  }> = {},
) {
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
    managementToken: "secret-management-token",
    isTest: false,
    ...overrides,
  };
}

async function setup(overrides: Parameters<typeof voucherFixture>[0] = {}) {
  const t = createConvexTest();
  await t.run((ctx) => ctx.db.insert("vouchers", voucherFixture(overrides)));
  return t;
}

test("a matching code and phone authorizes the lookup without leaking the management capability", async () => {
  const t = await setup();

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11999999999",
  });

  if (result.kind !== "authorized") throw new Error("Expected authorization");
  expect(result.voucher).toMatchObject({ code: "a1b2", status: "valid" });
  expect(JSON.stringify(result)).not.toContain("secret-management-token");
  expect(result.voucher).not.toHaveProperty("managementToken");

  const monitored = await t.query(api.vouchers.getAuthorized, {
    lookupToken: result.lookupToken,
  });
  expect(monitored).toEqual(result.voucher);
});

test("the token matches the one authorizeLookup issues for the same Voucher", async () => {
  const t = await setup();

  const byPhone = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11999999999",
  });
  const byCode = await t.mutation(api.vouchers.authorizeLookup, {
    code: "a1b2",
  });

  expect(byPhone).toEqual(byCode);
});

test("code input is trimmed and lowercased; phone formatting is ignored", async () => {
  const t = await setup();

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "  A1B2 ",
    phone: "(11) 99999-9999",
  });

  expect(result.kind).toBe("authorized");
});

test("a legacy formatted stored phone matches digits-only input", async () => {
  const t = await setup({ phone: "(11) 98765-4321" });

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11987654321",
  });

  expect(result.kind).toBe("authorized");
});

test("right code with the wrong phone is a generic not_found", async () => {
  const t = await setup();

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11888888888",
  });

  expect(result).toEqual({ kind: "not_found" });
});

test("wrong code with the right phone is a generic not_found", async () => {
  const t = await setup();

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "zzzz",
    phone: "11999999999",
  });

  expect(result).toEqual({ kind: "not_found" });
});

test("a soft-deleted Voucher is not_found even with the right phone", async () => {
  const t = await setup({ deletedAt: Date.now() });

  const result = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11999999999",
  });

  expect(result).toEqual({ kind: "not_found" });
});

test("malformed codes and phones are not_found", async () => {
  const t = await setup();
  const attempts = [
    { code: "abc", phone: "11999999999" },
    { code: "abcdefg", phone: "11999999999" },
    { code: "a1-b", phone: "11999999999" },
    { code: "", phone: "11999999999" },
    { code: "a1b2", phone: "123456789" },
    { code: "a1b2", phone: "119999999999" },
    { code: "a1b2", phone: "" },
  ];

  for (const attempt of attempts) {
    const result = await t.mutation(
      api.vouchers.authorizeLookupByPhone,
      attempt,
    );
    expect(result).toEqual({ kind: "not_found" });
  }
});

test("attempts spend the shared lookup limit with authorizeLookup", async () => {
  const t = await setup();

  for (let attempt = 1; attempt < VOUCHER_LOOKUP_BURST_LIMIT; attempt += 1) {
    await t.mutation(api.vouchers.authorizeLookup, { code: `miss-${attempt}` });
  }

  const lastAllowed = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11999999999",
  });
  const blocked = await t.mutation(api.vouchers.authorizeLookupByPhone, {
    code: "a1b2",
    phone: "11999999999",
  });

  expect(lastAllowed.kind).toBe("authorized");
  expect(blocked).toMatchObject({ kind: "rate_limited" });
});
