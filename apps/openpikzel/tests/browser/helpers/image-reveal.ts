import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

// Photographic fixtures, so blur-to-sharp is visible: 1280x720 crops of the repo's own original stills
// (public/brand, public/persona-guide.webp; see ASSETS.md), mirrored for variety. Nothing new is committed.
const stills: { file: string; crop?: { left: number; top: number; width: number; height: number }; flop?: boolean }[] = [
  { file: "public/brand/signal.webp" },
  { file: "public/persona-guide.webp", crop: { left: 0, top: 0, width: 960, height: 320 } },
  { file: "public/brand/aperture.webp" },
  { file: "public/persona-guide.webp", crop: { left: 0, top: 320, width: 960, height: 320 } },
  { file: "public/brand/signal.webp", flop: true },
  { file: "public/brand/aperture.webp", flop: true },
  { file: "public/persona-guide.webp", crop: { left: 0, top: 0, width: 960, height: 320 }, flop: true },
  { file: "public/persona-guide.webp", crop: { left: 0, top: 320, width: 960, height: 320 }, flop: true },
];
const still = (c: number) => { const { file, crop, flop } = stills[c]; let img = sharp(file); if (crop) img = img.extract(crop); if (flop) img = img.flop();
  return img.resize(1280, 720, { fit: "cover" }).png().toBuffer(); };
type Rule = { delayMs?: number; hold?: Promise<void>; fail?: boolean };

/**
 * Signed-in fixture studio for OP-10. Every request is answered locally (no provider, no network):
 * "Create thumbnail" returns `batch` new images, and each image file can be delayed, held or failed.
 */
export async function revealStudio(page: Page, opts: { start?: { title?: string; prompt?: string }[] } = {}) {
  const user = "11111111-1111-4111-8111-111111111111", chat = "33333333-3333-4333-8333-333333333333", now = new Date().toISOString();
  const session = { access_token: "header." + Buffer.from(JSON.stringify({ sub: user, exp: 4102444800 })).toString("base64url") + ".signature", refresh_token: "fixture-only-refresh",
    expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id: user, aud: "authenticated", role: "authenticated", email: "a@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: now } };
  const settings = { model: "flare", quality: "low", complexity: "low", format: "long", batch: 1 };
  const chats = [{ id: chat, user_id: user, title: "Fixture chat", draft: { prompt: "A factual fixture thumbnail with one clear subject", settings }, created_at: now, updated_at: now }];
  const creations: Record<string, unknown>[] = (opts.start ?? [{}]).map((s, i) => ({
    id: "5555555" + i + "-5555-4555-8555-555555555555", user_id: user, conversation_id: chat, title: s.title ?? "Fixture start image " + (i + 1),
    prompt: s.prompt ?? "A factual fixture thumbnail with one clear subject", mode: "generate", style: "Auto", persona_id: null, parent_id: null,
    image_path: user + "/start-" + i + ".png", status: "ready", favorite: false, settings, created_at: new Date(Date.parse(now) - (i + 1) * 60000).toISOString() }));
  const rules = new Map<string, Rule>(), fetched: string[] = [], generated: { batch: number; partial: boolean }[] = [];
  let made = 0, nextPartial: number | null = null, generateHold: Promise<void> | undefined;
  const pngs = new Map<number, Promise<Buffer>>();
  const png = (i: number) => { const c = i % stills.length; if (!pngs.has(c)) pngs.set(c, still(c)); return pngs.get(c)!; };
  await page.route("**/*", r => (new URL(r.request().url()).hostname === "127.0.0.1" || /^(blob|data):/.test(r.request().url())) ? r.continue() : r.abort());
  await page.addInitScript(({ session, user, chat }) => { localStorage.setItem("sb-test-auth-token", JSON.stringify(session)); localStorage.setItem("openpikzels.activeChat." + user, chat); }, { session, user, chat });
  await page.route("**/api/jobs", r => r.fulfill({ json: { jobs: [] } }));
  // Jev is not connected, so generation needs no scoring call (OP-7: images still generate without Jev).
  await page.route("**/api/config", r => r.fulfill({ json: { cloud: true, ai: true, openai: true, jev: false, google: false, ownerGate: false, supabaseUrl: "https://test.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.route("https://test.supabase.co/**", async route => {
    const req = route.request(), url = new URL(req.url()), headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.includes("/auth/")) return route.fulfill({ json: session.user, headers });
    if (url.pathname.includes("/storage/") && req.method() === "POST") { const paths = req.postDataJSON().paths || []; return route.fulfill({ json: paths.map((p: string) => ({ path: p, signedURL: "/object/sign/studio-assets/" + p + "?token=fixture" })), headers }); }
    if (url.pathname.includes("/storage/")) {
      const path = decodeURIComponent(url.pathname.split("/studio-assets/")[1] || ""), rule = rules.get(path) || {};
      fetched.push(path);
      if (rule.hold) await rule.hold;
      if (rule.delayMs) await new Promise(r => setTimeout(r, rule.delayMs));
      if (rule.fail) return route.fulfill({ status: 404, body: "missing", headers });
      const index = Number(path.match(/-(\d+)\.png$/)?.[1] ?? 0);
      return route.fulfill({ body: await png(path.includes("/start-") ? 7 - index : index), contentType: "image/png", headers });
    }
    const table = url.pathname.split("/").pop();
    if (req.method() !== "GET") return route.fulfill({ status: 201, body: "", headers });
    const data = (table === "studio_conversations" ? chats : table === "studio_creations" ? creations : []) as { id: string }[];
    const rows = data.filter(v => !url.searchParams.has("id") || url.searchParams.get("id") === "eq." + v.id);
    return route.fulfill({ json: req.headers().accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows, headers });
  });
  await page.route("**/api/generate", async r => {
    const input = r.request().postDataJSON(), batch = Number(input.settings?.batch || 1), count = nextPartial ?? batch;
    if (generateHold) await generateHold;
    const base = Date.now();
    const items = Array.from({ length: count }, (_, i) => {
      const n = made++;
      return { id: "9999999" + n + "-9999-4999-8999-" + String(n).padStart(12, "9"), user_id: user, conversation_id: chat, title: "Fixture result " + (n + 1),
        prompt: input.prompt, mode: "generate", style: "Auto", persona_id: null, parent_id: null, image_path: user + "/image-" + n + ".png",
        status: "ready", favorite: false, settings: { ...settings, batch }, created_at: new Date(base - i * 1000).toISOString() };
    });
    creations.unshift(...items);
    generated.push({ batch, partial: nextPartial !== null });
    nextPartial = null;
    return r.fulfill({ json: { creations: items, partial: count < batch } });
  });
  let opened = false;
  return {
    creations, fetched, generated,
    /** Image path the n-th generated image (0-based) will use. */
    path: (n: number) => user + "/image-" + n + ".png",
    rule(n: number, rule: Rule) { rules.set(user + "/image-" + n + ".png", rule); },
    async open() { if (!opened) { await page.goto("/"); await expect(page.locator(".review-summary")).toContainText("Fixture start image 1"); opened = true; } },
    /** Generates `batch` images (optionally a partial batch of `partial`); `holdGenerate` keeps the placeholder up. */
    async generate(batch: 1 | 2 | 4 = 1, o: { partial?: number; holdGenerate?: Promise<void>; prompt?: string } = {}) {
      await this.open();
      nextPartial = o.partial ?? null; generateHold = o.holdGenerate;
      const show = page.getByRole("button", { name: "Show prompt and settings", exact: true }), create = page.getByRole("button", { name: "Create thumbnail", exact: true });
      await expect(show.or(create)).toBeVisible();
      if (await show.isVisible()) await show.click();
      if (o.prompt) await page.getByLabel("Describe your thumbnail", { exact: true }).fill(o.prompt);
      await page.getByLabel("Images per request").selectOption(String(batch));
      await create.click();
    },
  };
}

/** Records every reveal-relevant change to images on the page, from page load. */
export async function recordReveals(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __reveals: unknown[] };
    w.__reveals = [];
    const seen = new WeakSet<Element>();
    const log = (img: HTMLImageElement, event: string) => {
      const s = getComputedStyle(img);
      w.__reveals.push({ t: performance.now(), event, src: img.getAttribute("src"), surface: img.closest(".review-canvas") ? "canvas" : img.closest(".chat-timeline") ? "strip" : img.closest(".creation-card") ? "card" : "other",
        cls: img.className, name: s.animationName, delay: s.animationDelay, complete: img.complete && img.naturalWidth > 0 });
    };
    new MutationObserver(() => {
      for (const img of document.querySelectorAll("img")) {
        if (!seen.has(img)) { seen.add(img); log(img, "mount"); img.addEventListener("load", () => log(img, "load")); }
      }
    }).observe(document, { subtree: true, childList: true });
    document.addEventListener("animationstart", e => { const t = e.target as Element; if (t instanceof HTMLImageElement && (e as AnimationEvent).animationName.startsWith("image-reveal")) log(t, "start:" + (e as AnimationEvent).animationName); }, true);
  });
}
export type RevealEvent = { t: number; event: string; src: string | null; surface: string; cls: string; name: string; delay: string; complete: boolean };
export const reveals = (page: Page) => page.evaluate(() => (window as unknown as { __reveals: RevealEvent[] }).__reveals);
export const clearReveals = (page: Page) => page.evaluate(() => { (window as unknown as { __reveals: unknown[] }).__reveals = []; });
export const starts = async (page: Page) => (await reveals(page)).filter(e => e.event.startsWith("start:"));
