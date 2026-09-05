import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // Server node:test suites run separately via `node --test`.
    include: ["convex/**/*.test.ts", "src/lib/**/*.test.ts"],
    testTimeout: 15000,
  },
});
