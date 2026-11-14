import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: { storageState: { cookies: [{ name: "openpikzels-entry", value: "studio", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] }, baseURL: "http://127.0.0.1:3232", launchOptions: { args: ["--no-sandbox"] }, screenshot: "only-on-failure" },
  webServer: { command: "npm run start -- --port 3232", env: { APP_ORIGIN: "http://127.0.0.1:3232", STUDIO_ENCRYPTION_KEY: "a".repeat(64) }, url: "http://127.0.0.1:3232", reuseExistingServer: false },
  reporter: "list",
});
