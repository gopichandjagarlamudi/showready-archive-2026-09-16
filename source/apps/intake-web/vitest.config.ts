import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    exclude: ["node_modules/**", ".next/**", "dist/**", "tests/e2e/**", "tests/redirects/**", "test-results/**"]
  }
})
