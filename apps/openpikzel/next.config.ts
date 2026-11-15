import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
const config: NextConfig = {
  poweredByHeader: false,
  // Library style images are read by the generate function (and MCP) as references.
  outputFileTracingIncludes: { "/api/generate": ["./public/styles/**"], "/mcp": ["./public/styles/**"] },
  // Pin the workspace root to this app; the repository root holds an unrelated Next app.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // Browsers request /favicon.ico regardless of the <link rel=icon>; serve the app icon instead of a 404.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
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
