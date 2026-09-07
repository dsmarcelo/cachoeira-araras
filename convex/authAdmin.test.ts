/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test } from "vitest";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";

const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalAdminPassword = process.env.ADMIN_PASSWORD;

function setAdminCredentials(username?: string, password?: string) {
  if (username === undefined) {
    delete process.env.ADMIN_USERNAME;
  } else {
    process.env.ADMIN_USERNAME = username;
  }

  if (password === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = password;
  }
}

beforeEach(() => {
  setAdminCredentials("first_admin", "a-long-test-password");
});

afterEach(() => {
  setAdminCredentials(originalAdminUsername, originalAdminPassword);
});

test("the internal bootstrap creates exactly one administrator", async () => {
  const t = createConvexTest();

  await t.action(internal.authAdmin.createFirstAdmin, {});

  const users: unknown = await t.query(components.betterAuth.adapter.findMany, {
    model: "user",
    paginationOpts: { cursor: null, numItems: 10 },
  });

  const userPage = z
    .object({
      page: z.array(
        z.object({
          username: z.string(),
          role: z.string(),
          email: z.string(),
        }),
      ),
    })
    .parse(users);
  const [user] = userPage.page;
  expect(user?.username).toBe("first_admin");
  expect(user?.role).toBe("admin");
  expect(user?.email).toMatch(/@internal\.invalid$/);

  setAdminCredentials("second_admin", "another-long-password");
  await expect(
    t.action(internal.authAdmin.createFirstAdmin, {}),
  ).rejects.toThrow(/first user already exists/);
});

test.each([
  {
    name: "missing username",
    username: undefined,
    password: "a-long-test-password",
    error: /ADMIN_USERNAME/,
  },
  {
    name: "short username",
    username: "ab",
    password: "a-long-test-password",
    error: /ADMIN_USERNAME/,
  },
  {
    name: "missing password",
    username: "first_admin",
    password: undefined,
    error: /ADMIN_PASSWORD/,
  },
  {
    name: "short password",
    username: "first_admin",
    password: "1234",
    error: /ADMIN_PASSWORD/,
  },
])("rejects $name without creating a user", async (credentials) => {
  setAdminCredentials(credentials.username, credentials.password);
  const t = createConvexTest();

  await expect(
    t.action(internal.authAdmin.createFirstAdmin, {}),
  ).rejects.toThrow(credentials.error);

  const users: unknown = await t.query(components.betterAuth.adapter.findMany, {
    model: "user",
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(z.object({ page: z.array(z.unknown()) }).parse(users).page).toHaveLength(
    0,
  );
});
