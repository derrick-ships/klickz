import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: { args: ["--no-sandbox"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start",
    env: {
      APP_ORIGIN: "http://127.0.0.1:3000",
      STUDIO_ENCRYPTION_KEY: "a".repeat(64),
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  reporter: "list",
});
