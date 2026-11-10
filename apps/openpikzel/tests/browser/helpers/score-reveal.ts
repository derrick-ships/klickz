import { expect, type Page } from "@playwright/test";
import { reviewFixture } from "./review-fixture";

export type Pillars = Partial<Record<"virality" | "clarity" | "idea" | "curiosity" | "emotion", number | null>>;
export type SeedScore = { title?: string; overall: number | null; pillars: Pillars };
export type Tick = { t: number; text: string; value: string | null; reveal: string | null; hidden: string | null; sr: string | null; slash: number | null };

/** Records every change to the score heading from page load, so tests can read the whole reveal. */
export async function recordScoreTicks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ticks: unknown[]; __fills: unknown[] | null };
    w.__ticks = []; w.__fills = null;
    let last = "";
    new MutationObserver(() => {
      const panel = document.querySelector(".score-panel"), h2 = panel?.querySelector(".score-header h2");
      if (!panel || !h2) return;
      const count = h2.querySelector(".score-count"), reveal = panel.getAttribute("data-reveal");
      const pad = count?.querySelector(".score-count-pad")?.textContent || "";
      const row = { t: performance.now(), text: h2.textContent || "", value: count ? (count.textContent || "").slice(pad.length) : null, reveal, hidden: count?.getAttribute("aria-hidden") ?? null,
        sr: h2.querySelector(".sr-only")?.textContent ?? null, slash: h2.querySelector("small")?.getBoundingClientRect().left ?? null };
      const sig = JSON.stringify({ ...row, t: 0 });
      if (sig === last) return;
      last = sig; w.__ticks.push(row);
      if (reveal === "running" && !w.__fills) w.__fills = [...panel.querySelectorAll(".pillar-meter progress")].map(p => {
        const s = getComputedStyle(p);
        return { label: p.getAttribute("aria-label"), name: s.animationName, delay: s.animationDelay, duration: s.animationDuration, easing: s.animationTimingFunction, iterations: s.animationIterationCount };
      });
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
}
export const ticks = (page: Page) => page.evaluate(() => (window as unknown as { __ticks: Tick[] }).__ticks);
export const fills = (page: Page) => page.evaluate(() => (window as unknown as { __fills: unknown[] | null }).__fills);
export const clearTicks = (page: Page) => page.evaluate(() => { const w = window as unknown as { __ticks: unknown[]; __fills: unknown }; w.__ticks = []; w.__fills = null; });

/** Local-only fixture: uploads one image, then writes explicit score fixtures into IndexedDB. No provider is called. */
export async function seedScores(page: Page, scores: SeedScore[], beforeReload?: () => Promise<void>) {
  await reviewFixture(page, false);
  await page.evaluate(async (scores) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("derrick-thumbnail-studio");
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("creations", "readwrite"), store = tx.objectStore("creations"), rows = store.getAll();
        rows.onsuccess = () => {
          const base = rows.result.find((c: { title: string }) => c.title.startsWith("Fixture:"));
          scores.forEach((s, i) => {
            const created = new Date(Date.now() - i * 60000).toISOString();
            const dims = Object.fromEntries(["virality", "clarity", "idea", "curiosity", "emotion"].map(p => {
              const v = (s.pillars as Record<string, number | null | undefined>)[p] ?? null;
              return [p, { score: v, confidence: .6, observation: "Fixture: one subject leads the composition.", strength: "Fixture: a clear red focal point.",
                weakness: "Fixture: small supporting text.", fix: "Fixture: simplify the supporting text.", ...(v === null ? { missingReason: "Fixture: the video summary is needed." } : {}) }];
            }));
            store.put({ ...base, ...(i ? { id: crypto.randomUUID(), created_at: created } : {}), title: s.title || base.title,
              score: { source: "jev", version: 3, overall: s.overall, partial: s.overall === null, title: s.title || base.title, priority: "clarity",
                created_at: created, note: "Explicit UI fixture. No provider was called.", warnings: [], dimensions: dims } });
          });
        };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }, scores);
  await beforeReload?.();
  await page.reload();
  await expect(page.locator(".score-panel")).toBeVisible();
}
