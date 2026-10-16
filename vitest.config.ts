import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors the `@/*` path alias from tsconfig.json so route handler tests
// can import modules using the same paths the product code uses.
export default defineConfig({
  test: {
    // .claude/worktrees/ holds gitignored local worktrees whose tests resolve
    // "@/" against THIS src, so they test a mix of two branches. Not part of
    // this repo's suite.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
