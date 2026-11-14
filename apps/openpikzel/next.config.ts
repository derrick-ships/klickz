import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
const config: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root to this app; the repository root holds an unrelated Next app.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
