import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    /**
     * Default to "node" for lib/ and api/ tests.
     * Component test files declare `// @vitest-environment jsdom` at the top.
     */
    environment: "node",

    /**
     * Glob for test files.  We keep them alongside source in __tests__ dirs.
     */
    include: ["**/__tests__/**/*.test.{ts,tsx}"],

    /**
     * Coverage — run with: npm run test:coverage
     * Targets only the source files we actually own.
     */
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts", "src/components/**/*.tsx"],
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
