import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors the `@/*` path alias from tsconfig.json so route handler tests
// can import modules using the same paths the product code uses.
export default defineConfig({
  test: {
    // Claude Code worktrees are checkouts of OTHER branches; their test copies
    // resolve `@` to this checkout's src and fail on version mismatches.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
