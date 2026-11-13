import { defineConfig } from "vitest/config";
import path from "path";

const DB_TESTS = "src/**/*-db.test.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts", "src/**/*.test.tsx"], exclude: [DB_TESTS, "**/node_modules/**"] } },
      // Isolated-Postgres suites share global settings (ERP module flags): one file at a time.
      { extends: true, test: { name: "db", include: [DB_TESTS], fileParallelism: false } },
    ],
  },
});
