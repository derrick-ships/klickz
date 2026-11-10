import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { reviewFixture } from "./review-fixture";

export type Pillars = Partial<Record<"virality" | "clarity" | "idea" | "curiosity" | "emotion", number | null>>;
export type SeedScore = { title?: string; overall: number | null; pillars: Pillars };
export type Tick = { t: number; text: string; value: string | null; reveal: string | null; hidden: string | null; sr: string | null; slash: number | null; announce: string };
export type Announcement = { t: number; text: string };

/** Records every change to the score heading from page load, so tests can read the whole reveal. */
export async function recordScoreTicks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ticks: unknown[]; __fills: unknown[] | null; __announce: unknown[] };
    w.__ticks = []; w.__fills = null; w.__announce = [];
    let last = "", spoken = "";
    new MutationObserver(() => {
      // Every polite score region on the page (panel and dialog), joined; each change is one possible announcement.
      const announce = [...document.querySelectorAll("[data-score-announcer]")].map(el => el.textContent || "").filter(Boolean).join("|");
      if (announce !== spoken) { spoken = announce; w.__announce.push({ t: performance.now(), text: announce }); }
      const panel = document.querySelector(".score-panel"), h2 = panel?.querySelector(".score-header h2");
      if (!panel || !h2) return;
      const count = h2.querySelector(".score-count"), reveal = panel.getAttribute("data-reveal");
      const pad = count?.querySelector(".score-count-pad")?.textContent || "";
      const row = { t: performance.now(), text: h2.textContent || "", value: count ? (count.textContent || "").slice(pad.length) : null, reveal, hidden: count?.getAttribute("aria-hidden") ?? null,
        sr: h2.querySelector(".sr-only")?.textContent ?? null, slash: h2.querySelector("small")?.getBoundingClientRect().left ?? null, announce };
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
export const announcements = (page: Page) => page.evaluate(() => (window as unknown as { __announce: Announcement[] }).__announce);
export const clearTicks = (page: Page) => page.evaluate(() => { const w = window as unknown as { __ticks: unknown[]; __fills: unknown; __announce: unknown[] }; w.__ticks = []; w.__fills = null; w.__announce = []; });

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

const pillarNames = ["virality", "clarity", "idea", "curiosity", "emotion"] as const;
export function scoreFixture(s: SeedScore, title: string) {
  return { source: "jev", version: 3, overall: s.overall, partial: s.overall === null, title, priority: "clarity",
    created_at: new Date().toISOString(), note: "Explicit UI fixture. No provider was called.", warnings: [], vision: false, fixBlocked: true,
    dimensions: Object.fromEntries(pillarNames.map(p => {
      const v = s.pillars[p] ?? null;
      return [p, { score: v, confidence: .6, observation: "Fixture: one subject leads the composition.", strength: "Fixture: a clear red focal point.",
        weakness: "Fixture: small supporting text.", fix: "Fixture: simplify the supporting text.", ...(v === null ? { missingReason: "Fixture: the video summary is needed." } : {}) }];
    })) };
}

/**
 * Signed-in fixture workspace (every network call is fulfilled locally; nothing reaches a provider)
 * where scores arrive in-session: "Create thumbnail" saves a new image, and the score that every
 * generate requests (OP-7) returns the next queued score; the new image is shown with it.
 */
export async function arrivalStudio(page: Page) {
  const user = "11111111-1111-4111-8111-111111111111", chat = "33333333-3333-4333-8333-333333333333", now = new Date().toISOString();
  const session = { access_token: "header." + Buffer.from(JSON.stringify({ sub: user, exp: 4102444800 })).toString("base64url") + ".signature", refresh_token: "fixture-only-refresh",
    expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id: user, aud: "authenticated", role: "authenticated", email: "a@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: now } };
  const settings = { model: "flare", quality: "low", complexity: "low", format: "long", batch: 1 };
  const chats = [{ id: chat, user_id: user, title: "Fixture chat", draft: { prompt: "A factual fixture thumbnail with one clear subject", settings }, created_at: now, updated_at: now }];
  // One unscored image is already in the library, so the studio opens on a selected creation.
  const creations: Record<string, unknown>[] = [{ id: "55555555-5555-4555-8555-555555555555", user_id: user, conversation_id: chat, title: "Fixture start image",
    prompt: "A factual fixture thumbnail with one clear subject", mode: "generate", style: "Auto", persona_id: null, parent_id: null, image_path: user + "/image.png",
    status: "ready", favorite: false, settings, created_at: now }];
  const queue: { score: SeedScore; hold?: Promise<void> }[] = [], paid: string[] = [];
  const png = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#dc384b" } }).png().toBuffer();
  await page.route("**/*", r => (new URL(r.request().url()).hostname === "127.0.0.1" || /^(blob|data):/.test(r.request().url())) ? r.continue() : r.abort());
  await page.addInitScript(({ session, user, chat }) => { localStorage.setItem("sb-test-auth-token", JSON.stringify(session)); localStorage.setItem("openpikzels.activeChat." + user, chat); }, { session, user, chat });
  await page.route("**/api/jobs", r => r.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/config", r => r.fulfill({ json: { cloud: true, ai: true, openai: true, jev: true, google: false, ownerGate: false, supabaseUrl: "https://test.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.route("https://test.supabase.co/**", async route => {
    const req = route.request(), url = new URL(req.url()), headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.includes("/auth/")) return route.fulfill({ json: session.user, headers });
    if (url.pathname.includes("/storage/") && req.method() === "POST") { const paths = req.postDataJSON().paths || []; return route.fulfill({ json: paths.map((p: string) => ({ path: p, signedURL: "/object/sign/studio-assets/" + p + "?token=fixture" })), headers }); }
    if (url.pathname.includes("/storage/")) return route.fulfill({ body: png, contentType: "image/png", headers });
    const table = url.pathname.split("/").pop();
    if (req.method() !== "GET") return route.fulfill({ status: 201, body: "", headers });
    const data = (table === "studio_conversations" ? chats : table === "studio_creations" ? creations : []) as { id: string }[];
    const rows = data.filter(v => !url.searchParams.has("id") || url.searchParams.get("id") === "eq." + v.id);
    return route.fulfill({ json: req.headers().accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows, headers });
  });
  await page.route("**/api/generate", r => {
    paid.push("generate");
    const n = creations.length + 1, item = { id: "9999999" + n + "-9999-4999-8999-999999999999", user_id: user, conversation_id: chat, title: "Fixture result " + n,
      prompt: r.request().postDataJSON().prompt, mode: "generate", style: "Auto", persona_id: null, parent_id: null, image_path: user + "/image-" + n + ".png",
      status: "ready", favorite: false, settings, created_at: new Date(Date.now() + n).toISOString() };
    creations.unshift(item);
    return r.fulfill({ json: { creations: [item], partial: false } });
  });
  await page.route("**/api/analyze", async r => {
    paid.push("analyze");
    const input = r.request().postDataJSON(), item = creations.find(c => c.id === input.creationId)!, next = queue.shift()!;
    await next.hold;
    item.score = scoreFixture(next.score, String(item.title));
    return r.fulfill({ json: { score: item.score, creationId: item.id } });
  });
  let opened = false;
  return {
    creations, paid,
    /** Generates one new image and its score. `hold` delays the score (and, under OP-7, the image reveal). */
    async arrive(score: SeedScore, hold?: Promise<void>) {
      queue.push({ score, hold });
      const show = page.getByRole("button", { name: "Show prompt and settings", exact: true }), create = page.getByRole("button", { name: "Create thumbnail", exact: true });
      if (!opened) { await page.goto("/"); await expect(page.locator(".review-summary")).toContainText("Fixture start image"); opened = true; }
      await expect(show.or(create)).toBeVisible();
      if (await show.isVisible()) await show.click();
      const delivery = page.getByRole("region", { name: "Thumbnail delivery" }), n = creations.length + 1;
      await page.getByRole("button", { name: "Create thumbnail", exact: true }).click();
      // With every generate scored (OP-7), the image is revealed together with its score; a held score holds the image.
      if (hold) return;
      await expect(page.locator(".review-summary")).toContainText("Fixture result " + n);
      await expect(delivery).toHaveAttribute("data-stage", "ready");
    },
  };
}
