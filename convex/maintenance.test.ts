/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { SchemaDefinition } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Schema = typeof schema extends SchemaDefinition<infer S, boolean>
  ? S
  : never;
type ConvexTest = ReturnType<typeof convexTest<Schema>>;

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
    status: "valid" as "pending" | "valid" | "redeemed" | "expired",
    visitDate: "2026-01-05",
    expiresAt: Date.UTC(2026, 0, 5, 3, 0, 0) - 1 + 24 * 60 * 60 * 1000,
    preferenceId: "pref-1",
    paymentId: undefined as string | undefined,
    isTest: false,
  };
}

/**
 * Inserts a voucher whose `_creationTime` is exactly `atMs`, by faking the
 * system clock convex-test's backend stamps documents with. Mirrors the
 * helper in vouchers.summary.test.ts.
 */
async function insertVoucherAt(
  t: ConvexTest,
  atMs: number,
  overrides: Partial<ReturnType<typeof defaults>> = {},
) {
  vi.useFakeTimers();
  vi.setSystemTime(atMs);
  try {
    const voucher = { ...defaults(), ...overrides };
    await t.run(async (ctx) => ctx.db.insert("vouchers", voucher));
    return voucher;
  } finally {
    vi.useRealTimers();
  }
}

async function runMaintenanceAt(t: ConvexTest, atMs: number) {
  vi.useFakeTimers();
  vi.setSystemTime(atMs);
  try {
    await t.mutation(internal.maintenance.runDailyMaintenance, {});
  } finally {
    vi.useRealTimers();
  }
}

async function getByCode(t: ConvexTest, code: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique(),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

test("a Valid voucher past its Expiry becomes expired; one still within its Expiry is untouched", async () => {
  const t = convexTest(schema, modules);
  const expiresAt = Date.UTC(2026, 0, 5, 12, 0, 0);
  await insertVoucherAt(t, expiresAt - DAY_MS, {
    code: "past",
    status: "valid",
    expiresAt,
  });
  await insertVoucherAt(t, expiresAt - DAY_MS, {
    code: "future",
    status: "valid",
    expiresAt: expiresAt + DAY_MS,
  });

  await runMaintenanceAt(t, expiresAt + 1000);

  expect((await getByCode(t, "past"))?.status).toBe("expired");
  expect((await getByCode(t, "future"))?.status).toBe("valid");
});

test("a redeemed voucher is never transitioned by the job", async () => {
  const t = convexTest(schema, modules);
  const expiresAt = Date.UTC(2026, 0, 5, 12, 0, 0);
  await insertVoucherAt(t, expiresAt - DAY_MS, {
    code: "used",
    status: "redeemed",
    expiresAt,
  });

  await runMaintenanceAt(t, expiresAt + 1000);

  expect((await getByCode(t, "used"))?.status).toBe("redeemed");
  expect((await getByCode(t, "used"))?.deletedAt).toBeUndefined();
});

test("a Pending Voucher is soft-deleted at or after its Expiry, and untouched before it", async () => {
  const t = convexTest(schema, modules);
  const expiresAt = Date.UTC(2026, 0, 5, 12, 0, 0);
  await insertVoucherAt(t, expiresAt - DAY_MS, {
    code: "at-expiry",
    status: "pending",
    expiresAt,
  });
  await insertVoucherAt(t, expiresAt - DAY_MS, {
    code: "not-yet",
    status: "pending",
    expiresAt: expiresAt + DAY_MS,
  });

  // Exactly at the job's current time: "at or before" means this one is
  // soft-deleted too, not just strictly-past ones.
  await runMaintenanceAt(t, expiresAt);

  const atExpiry = await getByCode(t, "at-expiry");
  expect(atExpiry?.deletedAt).toBeDefined();
  expect(atExpiry?.status).toBe("pending"); // soft-deleted, not status-transitioned

  const notYet = await getByCode(t, "not-yet");
  expect(notYet?.deletedAt).toBeUndefined();
});

test("a Test Voucher is hard-deleted at thirty days old, and left alone at twenty-nine", async () => {
  const t = convexTest(schema, modules);
  const createdAt = Date.UTC(2026, 0, 1, 12, 0, 0);
  await insertVoucherAt(t, createdAt, {
    code: "thirty",
    status: "redeemed", // status shouldn't matter for this rule
    isTest: true,
    expiresAt: createdAt + DAY_MS,
  });
  await insertVoucherAt(t, createdAt, {
    code: "twentynine",
    isTest: true,
    expiresAt: createdAt + DAY_MS,
  });

  await runMaintenanceAt(t, createdAt + 30 * DAY_MS);
  expect(await getByCode(t, "thirty")).toBeNull();
  expect(await getByCode(t, "twentynine")).not.toBeNull();

  await runMaintenanceAt(t, createdAt + 29 * DAY_MS);
  expect(await getByCode(t, "twentynine")).not.toBeNull();
});

test("real vouchers are never hard-deleted, no matter how old or how far past their Expiry", async () => {
  const t = convexTest(schema, modules);
  const createdAt = Date.UTC(2026, 0, 1, 12, 0, 0);
  await insertVoucherAt(t, createdAt, {
    code: "old-real-valid",
    status: "valid",
    isTest: false,
    expiresAt: createdAt + DAY_MS,
  });
  await insertVoucherAt(t, createdAt, {
    code: "old-real-pending",
    status: "pending",
    isTest: false,
    expiresAt: createdAt + DAY_MS,
  });

  await runMaintenanceAt(t, createdAt + 365 * DAY_MS);

  expect(await getByCode(t, "old-real-valid")).not.toBeNull();
  expect(await getByCode(t, "old-real-pending")).not.toBeNull();
});
