// Production-build lab budgets. No remote upload or authenticated/paid work.
const BUDGETS = Object.freeze({ LCP_MS: 2500, CLS: .1, TBT_MS: 200,
  PERFORMANCE: .90, ACCESSIBILITY: .95, BEST_PRACTICES: .90, SEO: .95,
  SCRIPT_BYTES: 300000, CSS_BYTES: 100000, IMAGE_BYTES: 500000, TOTAL_BYTES: 1500000 });
const median = { aggregationMethod: "median-run" };
const profile = process.env.LHCI_PROFILE === "desktop" ? "desktop" : "mobile";
module.exports = { ci: {
  collect: { url: ["http://127.0.0.1:3001/", "http://127.0.0.1:3001/studio"], numberOfRuns: 3,
    startServerCommand: "npm run start -- --port 3001", startServerReadyPattern: "Ready in", startServerReadyTimeout: 30000,
    settings: { chromeFlags: "--no-sandbox --disable-dev-shm-usage", ...(profile === "desktop" ? { preset: "desktop" } : {}) } },
  assert: { assertions: {
    "largest-contentful-paint": ["error", { ...median, maxNumericValue: BUDGETS.LCP_MS }],
    "cumulative-layout-shift": ["error", { ...median, maxNumericValue: BUDGETS.CLS }],
    "total-blocking-time": ["error", { ...median, maxNumericValue: BUDGETS.TBT_MS }],
    "categories:performance": ["error", { ...median, minScore: BUDGETS.PERFORMANCE }],
    "categories:accessibility": ["error", { ...median, minScore: BUDGETS.ACCESSIBILITY }],
    "categories:best-practices": ["error", { ...median, minScore: BUDGETS.BEST_PRACTICES }],
    "categories:seo": ["error", { ...median, minScore: BUDGETS.SEO }],
    "resource-summary:script:size": ["error", { ...median, maxNumericValue: BUDGETS.SCRIPT_BYTES }],
    "resource-summary:stylesheet:size": ["error", { ...median, maxNumericValue: BUDGETS.CSS_BYTES }],
    "resource-summary:image:size": ["error", { ...median, maxNumericValue: BUDGETS.IMAGE_BYTES }],
    "resource-summary:total:size": ["error", { ...median, maxNumericValue: BUDGETS.TOTAL_BYTES }],
    "resource-summary:third-party:count": ["error", { ...median, maxNumericValue: 0 }]
  } },
  upload: { target: "filesystem", outputDir: `evidence/lighthouse/${profile}` }
} };
