import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts", "evals/**/*.test.ts"],
          exclude: ["apps/widget/**", "**/node_modules/**", "**/.git/**", "**/dist/**"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        test: {
          name: "widget",
          root: "./apps/widget",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
