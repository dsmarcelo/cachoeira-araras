/// <reference types="vite/client" />
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { createConvexTest, withAuth } from "./test.setup";

test("set records who made the change and when", async () => {
  const t = createConvexTest();
  const asAdmin = await withAuth(t, "admin");

  const before = Date.now();
  await asAdmin.mutation(api.settings.set, {
    key: "top.message",
    value: "Fechado hoje",
  });
  const after = Date.now();

  const [entry] = await asAdmin.query(api.settings.list, {});
  expect(entry).toMatchObject({ key: "top.message", value: "Fechado hoje" });
  expect(entry?.updatedBy).toEqual(expect.any(String));
  expect(entry?.updatedAt).toBeGreaterThanOrEqual(before);
  expect(entry?.updatedAt).toBeLessThanOrEqual(after);
});

test("a later admin write to the same key overwrites the editor and timestamp", async () => {
  const t = createConvexTest();
  const asFirstAdmin = await withAuth(t, "admin");
  const asSecondAdmin = await withAuth(t, "admin");

  await asFirstAdmin.mutation(api.settings.set, {
    key: "max.intended.days",
    value: 60,
  });
  await asSecondAdmin.mutation(api.settings.set, {
    key: "max.intended.days",
    value: 45,
  });

  const result = await asSecondAdmin.query(api.settings.get, {
    key: "max.intended.days",
  });
  expect(result).toEqual({ key: "max.intended.days", value: 45 });

  const [entry] = await asSecondAdmin.query(api.settings.list, {});
  expect(entry?.updatedBy).toEqual(expect.any(String));
});

test("list is admin-only", async () => {
  const t = createConvexTest();
  const asEmployee = await withAuth(t, "employee");

  await expect(t.query(api.settings.list, {})).rejects.toThrow(/401/);
  await expect(asEmployee.query(api.settings.list, {})).rejects.toThrow(/403/);
});
