import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
      environment: "node",
    },
  },
]);
