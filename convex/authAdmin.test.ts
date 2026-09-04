/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { createConvexTest } from "./test.setup";

test("the internal bootstrap creates exactly one administrator", async () => {
  const t = createConvexTest();

  await t.action(internal.authAdmin.createFirstAdmin, {
    username: "first_admin",
    password: "a-long-test-password",
  });

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

  await expect(
    t.action(internal.authAdmin.createFirstAdmin, {
      username: "second_admin",
      password: "another-long-password",
    }),
  ).rejects.toThrow(/first user already exists/);
});
