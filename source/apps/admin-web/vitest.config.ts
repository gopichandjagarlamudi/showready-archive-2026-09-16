import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "lib/test-utils/server-only-mock.ts")
    }
  },
  test: {
    exclude: ["node_modules/**", ".next/**", "dist/**"],
    setupFiles: ["./vitest.setup.ts"]
  }
})
