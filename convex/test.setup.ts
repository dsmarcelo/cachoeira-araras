/// <reference types="vite/client" />
// The component's internal schema module has no published subpath export, so
// it's imported by relative file path into node_modules for test-only
// registration (mirrors the pattern convex-test itself expects — see
// `rateLimiterModules` below, which globs the same source tree).
import rateLimiterSchema from "../node_modules/@convex-dev/rate-limiter/src/component/schema";
import { convexTest, type TestConvex } from "convex-test";

import { components } from "./_generated/api";
import betterAuthSchema from "./betterAuth/schema";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const betterAuthModules = import.meta.glob("./betterAuth/**/*.ts");
const rateLimiterModules = import.meta.glob(
  "../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

export function createConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

function readId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("_id" in value) ||
    typeof value._id !== "string"
  ) {
    throw new Error("Better Auth test record did not return an id");
  }
  return value._id;
}

export async function withAuth(
  t: TestConvex<typeof schema>,
  role: "admin" | "employee",
) {
  const now = Date.now();
  const user: unknown = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name: `${role}-${crypto.randomUUID()}`,
        email: `${crypto.randomUUID()}@internal.invalid`,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        username: `${role}-${crypto.randomUUID()}`,
        role: role === "employee" ? "user" : "admin",
      },
    },
  });
  const userId = readId(user);
  const session: unknown = await t.mutation(
    components.betterAuth.adapter.create,
    {
      input: {
        model: "session",
        data: {
          userId,
          token: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          expiresAt: now + 60_000,
        },
      },
    },
  );

  return t.withIdentity({
    subject: userId,
    sessionId: readId(session),
  });
}
