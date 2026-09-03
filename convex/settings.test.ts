/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("set records who made the change and when", async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity({
    subject: "admin-1",
    "properties.role": "admin",
  });

  const before = Date.now();
  await asAdmin.mutation(api.settings.set, {
    key: "top.message",
    value: "Fechado hoje",
  });
  const after = Date.now();

  const [entry] = await asAdmin.query(api.settings.list, {});
  expect(entry).toMatchObject({ key: "top.message", value: "Fechado hoje" });
  expect(entry?.updatedBy).toBe("admin-1");
  expect(entry?.updatedAt).toBeGreaterThanOrEqual(before);
  expect(entry?.updatedAt).toBeLessThanOrEqual(after);
});

test("a later admin write to the same key overwrites the editor and timestamp", async () => {
  const t = convexTest(schema, modules);
  const asFirstAdmin = t.withIdentity({
    subject: "admin-1",
    "properties.role": "admin",
  });
  const asSecondAdmin = t.withIdentity({
    subject: "admin-2",
    "properties.role": "admin",
  });

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
  expect(entry?.updatedBy).toBe("admin-2");
});

test("list is admin-only", async () => {
  const t = convexTest(schema, modules);

  await expect(t.query(api.settings.list, {})).rejects.toThrow(/401/);
  await expect(
    t
      .withIdentity({ "properties.role": "employee" })
      .query(api.settings.list, {}),
  ).rejects.toThrow(/403/);
});
