import { defineConfig } from "@playwright/test";

const port = process.env.PORT || "3000";
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
    command: "npm run start",
    env: {
      PORT: port,
      APP_ORIGIN: origin,
      STUDIO_ENCRYPTION_KEY: "a".repeat(64),
    },
    url: origin,
    reuseExistingServer: process.env.NODE_ENV === "development",
    timeout: 120000,
  },
  reporter: "list",
});
