import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors the `@/*` path alias from tsconfig.json so route handler tests
// can import modules using the same paths the product code uses.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
