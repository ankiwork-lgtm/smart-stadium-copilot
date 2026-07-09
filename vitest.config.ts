import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    /**
     * Use the "node" environment — no DOM needed for lib/ and api/ tests.
     * Individual test files that need DOM can override with:
     *   // @vitest-environment jsdom
     */
    environment: "node",

    /**
     * Glob for test files.  We keep them alongside source in __tests__ dirs.
     */
    include: ["**/__tests__/**/*.test.ts"],

    /**
     * Coverage — run with: npm run test:coverage
     * Targets only the source files we actually own.
     */
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/__tests__/**", "node_modules/**"],
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
