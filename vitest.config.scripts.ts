import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts: scripts/ tests are plain node code (no
// convex-test, no edge-runtime) exercising the import script's pure
// transform functions.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
