/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { requireRole } from "./auth";

const modules = import.meta.glob("../**/*.ts");

test("a staff-only check rejects a public (unauthenticated) caller", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.run((ctx) => requireRole(ctx, "employee")),
  ).rejects.toThrow(/401/);
});

test("a staff-only check accepts both an employee and an admin identity", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.withIdentity({ "properties.role": "employee" }).run((ctx) => requireRole(ctx, "employee")),
  ).resolves.toBe("employee");
  await expect(
    t.withIdentity({ "properties.role": "admin" }).run((ctx) => requireRole(ctx, "employee")),
  ).resolves.toBe("admin");
});

test("an admin-only check rejects a staff (employee) identity", async () => {
  const t = convexTest(schema, modules);
  const asEmployee = t.withIdentity({ "properties.role": "employee" });

  await expect(
    asEmployee.run((ctx) => requireRole(ctx, "admin")),
  ).rejects.toThrow(/403/);
});

test("a public function ignores a role argument if the args happen to include one", async () => {
  const t = convexTest(schema, modules);

  // `settings.get` never accepts a role arg at all — this proves the public
  // read path works with no identity, regardless of what a caller might try
  // to smuggle in as an extra field (Convex's arg validator would reject an
  // unknown field outright).
  const result = await t.query(api.settings.get, { key: "does-not-exist" });
  expect(result).toBeNull();
});

test("an admin-only mutation rejects an unauthenticated caller", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.mutation(api.settings.set, { key: "featureFlag", value: true }),
  ).rejects.toThrow(/401/);
});

test("an admin-only mutation rejects a forged role claim from an employee identity", async () => {
  const t = convexTest(schema, modules);
  const asEmployee = t.withIdentity({ "properties.role": "employee" });

  await expect(
    asEmployee.mutation(api.settings.set, {
      key: "featureFlag",
      value: true,
    }),
  ).rejects.toThrow(/403/);
});

test("an admin-only mutation succeeds for an admin identity, and the write is visible to everyone", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({ "properties.role": "admin" });

  await asAdmin.mutation(api.settings.set, {
    key: "featureFlag",
    value: true,
  });

  const result = await t.query(api.settings.get, { key: "featureFlag" });
  expect(result).toEqual({ key: "featureFlag", value: true });
});
