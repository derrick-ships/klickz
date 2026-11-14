import type { Page } from "@playwright/test";
// The studio keeps advanced controls (model, quality, styles, provider, video link)
// behind one "More options" disclosure. Tests that use them open it first.
export async function openMoreOptions(page: Page) {
  const closed = page.locator("details.more-options:not(.request-readiness):not([open]) > summary");
  const n = await closed.count();
  for (let i = 0; i < n; i++) {
    const summary = closed.first();
    if (!(await summary.isVisible().catch(() => false))) break;
    await summary.click();
  }
}
