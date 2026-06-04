import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@ai-radar/ai": fromRoot("./packages/ai/src/index.ts"),
      "@ai-radar/config": fromRoot("./packages/config/src/index.ts"),
      "@ai-radar/crawler": fromRoot("./packages/crawler/src/index.ts"),
      "@ai-radar/db": fromRoot("./packages/db/src/index.ts"),
      "@ai-radar/email": fromRoot("./packages/email/src/index.ts"),
      "@ai-radar/parser": fromRoot("./packages/parser/src/index.ts"),
      "@ai-radar/prompts": fromRoot("./packages/prompts/src/index.ts"),
      "@ai-radar/reports": fromRoot("./packages/reports/src/index.ts"),
      "@ai-radar/scoring": fromRoot("./packages/scoring/src/index.ts"),
      "@ai-radar/shared": fromRoot("./packages/shared/src/index.ts"),
      "@ai-radar/usage": fromRoot("./packages/usage/src/index.ts")
    }
  }
});
