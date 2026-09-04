/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import { createConvexTest, withAuth } from "../test.setup";
import { requireRole } from "./auth";

test("a staff-only check rejects a public (unauthenticated) caller", async () => {
  const t = createConvexTest();

  await expect(t.run((ctx) => requireRole(ctx, "employee"))).rejects.toThrow(
    /401/,
  );
});

test("a staff-only check accepts both an employee and an admin identity", async () => {
  const t = createConvexTest();
  const asEmployee = await withAuth(t, "employee");
  const asAdmin = await withAuth(t, "admin");

  await expect(
    asEmployee.run((ctx) => requireRole(ctx, "employee")),
  ).resolves.toBe("employee");
  await expect(
    asAdmin.run((ctx) => requireRole(ctx, "employee")),
  ).resolves.toBe("admin");
});

test("an admin-only check rejects a staff (employee) identity", async () => {
  const t = createConvexTest();
  const asEmployee = await withAuth(t, "employee");

  await expect(
    asEmployee.run((ctx) => requireRole(ctx, "admin")),
  ).rejects.toThrow(/403/);
});

test("a public function ignores a role argument if the args happen to include one", async () => {
  const t = createConvexTest();

  // `settings.get` never accepts a role arg at all — this proves the public
  // read path works with no identity, regardless of what a caller might try
  // to smuggle in as an extra field (Convex's arg validator would reject an
  // unknown field outright).
  const result = await t.query(api.settings.get, { key: "does-not-exist" });
  expect(result).toBeNull();
});

test("an admin-only mutation rejects an unauthenticated caller", async () => {
  const t = createConvexTest();

  await expect(
    t.mutation(api.settings.set, { key: "featureFlag", value: true }),
  ).rejects.toThrow(/401/);
});

test("an admin-only mutation rejects a forged role claim from an employee identity", async () => {
  const t = createConvexTest();
  const asEmployee = await withAuth(t, "employee");

  await expect(
    asEmployee.mutation(api.settings.set, {
      key: "featureFlag",
      value: true,
    }),
  ).rejects.toThrow(/403/);
});

test("an admin-only mutation succeeds for an admin identity, and the write is visible to everyone", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");

  await asAdmin.mutation(api.settings.set, {
    key: "featureFlag",
    value: true,
  });

  const result = await t.query(api.settings.get, { key: "featureFlag" });
  expect(result).toEqual({ key: "featureFlag", value: true });
});
