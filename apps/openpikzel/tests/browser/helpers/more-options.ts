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

// The review screen keeps Download visible and puts every other image action under "More".
export async function openResultMore(page: Page) {
  const menu = page.locator("details.result-more").first();
  await menu.waitFor({ state: "visible", timeout: 15000 });
  if ((await menu.getAttribute("open")) === null) await menu.locator("> summary").click();
}
