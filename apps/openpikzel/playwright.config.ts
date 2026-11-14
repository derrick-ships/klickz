import { defineConfig } from "@playwright/test";
// PLAYWRIGHT_PORT selects an isolated production server and never reuses an
// existing one, so an occupied port fails the run instead of silently testing
// another server. PORT keeps working for the earlier workflow; an existing
// server is reused only in development.
const selected = process.env.PLAYWRIGHT_PORT;
if (selected && !/^\d{2,5}$/.test(selected)) throw new Error("PLAYWRIGHT_PORT must be a port number.");
const port = selected || process.env.PORT || "3000";
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/browser",
  use: {
    storageState: {"cookies":[{"name":"openpikzels-entry","value":"studio","domain":"127.0.0.1","path":"/","expires":-1,"httpOnly":false,"secure":false,"sameSite":"Lax"}],"origins":[]},
    baseURL: origin,
    launchOptions: { args: ["--no-sandbox"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    env: {
      PORT: port,
      APP_ORIGIN: origin,
      STUDIO_ENCRYPTION_KEY: "a".repeat(64),
    },
    url: origin,
    reuseExistingServer: !selected && process.env.NODE_ENV === "development",
    timeout: 120000,
  },
  reporter: "list",
});
