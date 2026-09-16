import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/redirects",
  use: { baseURL: "http://127.0.0.1:3101" },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3101",
    port: 3101,
    reuseExistingServer: false,
  },
})
