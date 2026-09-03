import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // Only Convex functions use vitest/convex-test; src/server/*.test.ts
    // files are node:test suites run separately via `node --test`.
    include: ["convex/**/*.test.ts"],
  },
});
