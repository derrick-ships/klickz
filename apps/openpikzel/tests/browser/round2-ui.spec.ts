import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

// Round 2 (Derrick's iPhone notes): batch placeholders, tappable tiles, badge → full score, @persona mentions,
// the Styles library without sideways scroll, and Pik + verbs with a concrete live region. All local fixtures.
const A = "11111111-1111-4111-8111-111111111111", chat = "33333333-3333-4333-8333-333333333333", now = "2026-11-10T00:00:00.000Z";
const startId = "55555555-5555-4555-8555-555555555555", personaId = "44444444-4444-4444-8444-444444444444";
const colors = ["#dc384b", "#3866dc", "#38dc8a", "#dcb238", "#9b38dc"];

function session(id: string) {
  return { access_token: "header." + Buffer.from(JSON.stringify({ sub: id, exp: 4102444800 })).toString("base64url") + ".signature", refresh_token: "fixture-only-refresh", expires_at: 4102444800, expires_in: 3600, token_type: "bearer",
    user: { id, aud: "authenticated", role: "authenticated", email: "a@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-11-08T00:00:00Z" } };
}
function score(overall: number, title = "Fixture title") {
  const dimensions = Object.fromEntries(["virality", "clarity", "idea", "curiosity", "emotion"].map((p, i) => [p, { score: Math.max(0, Math.min(100, overall - 6 + i * 3)), confidence: .7, observation: "Fixture observation", strength: "Visible subject", weakness: "Competing text", fix: "Reduce competing text" }]));
  return { source: "jev", version: 3, title, overall, priority: "clarity", created_at: now, note: "Fixture score. No provider called.", vision: true, fixBlocked: false, warnings: [],
    contributors: [{ provider: "Jev", model: "jev-latest", role: "scoring" }, { provider: "OpenAI API", model: "fixture", role: "image-review" }], dimensions };
}

async function setup(page: Page, opts: { generateDelayMs?: number; scores?: number[] } = {}) {
  const settings = { model: "flare", quality: "low", complexity: "low", format: "long", batch: 1 };
  const chats: any[] = [{ id: chat, user_id: A, title: "Fixture chat", draft: { prompt: "A factual fixture thumbnail with one clear subject", settings }, created_at: now, updated_at: now }];
  const creations: any[] = [{ id: startId, user_id: A, conversation_id: chat, title: "Fixture start", prompt: "A factual fixture thumbnail with one clear subject", mode: "generate", style: "Auto", persona_id: null, parent_id: null, image_path: A + "/start.png", status: "ready", favorite: false, settings, created_at: now, score: score(62) }];
  const personas: any[] = [{ id: personaId, user_id: A, name: "Derrick", notes: "", refs: [A + "/persona.png"], created_at: now }, { id: "44444444-4444-4444-8444-444444444445", user_id: A, name: "Dana", notes: "", refs: [A + "/persona2.png"], created_at: now }];
  const deleted: { table: string; ids: string[] }[] = [], removedFiles: string[] = [];
  const pngs = await Promise.all(colors.map(c => sharp({ create: { width: 1280, height: 720, channels: 3, background: c } }).png().toBuffer()));
  const scores = opts.scores ?? [71, 58, 84, 66];
  await page.route("**/*", r => (new URL(r.request().url()).hostname === "127.0.0.1" || /^(blob|data):/.test(r.request().url())) ? r.continue() : r.abort());
  await page.addInitScript(({ s, A, chat }) => { localStorage.setItem("sb-test-auth-token", JSON.stringify(s)); localStorage.setItem("openpikzels.activeChat." + A, chat); }, { s: session(A), A, chat });
  await page.route("**/api/jobs", r => r.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/estimate", r => r.fulfill({ json: { medianMs: 4000, samples: 9 } }));
  await page.route("**/api/config", r => r.fulfill({ json: { cloud: true, ai: true, openai: true, jev: true, google: false, anthropic: false, ownerGate: false, supabaseUrl: "https://test.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.route("https://test.supabase.co/**", async route => {
    const req = route.request(), url = new URL(req.url()), headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.includes("/auth/")) return route.fulfill({ json: session(A).user, headers });
    if (url.pathname.includes("/storage/") && req.method() === "DELETE") { removedFiles.push(...(req.postDataJSON()?.prefixes || [])); return route.fulfill({ json: [], headers }); }
    if (url.pathname.includes("/storage/") && req.method() === "POST") { const paths = req.postDataJSON().paths || []; return route.fulfill({ json: paths.map((p: string) => ({ path: p, signedURL: "/object/sign/studio-assets/" + p + "?token=fixture" })), headers }); }
    if (url.pathname.includes("/storage/")) { const n = Number(url.pathname.match(/image-(\d+)\.png/)?.[1] ?? 4); return route.fulfill({ body: pngs[n % pngs.length], contentType: "image/png", headers }); }
    const table = url.pathname.split("/").pop(), data = table === "studio_conversations" ? chats : table === "studio_creations" ? creations : table === "studio_personas" ? personas : [];
    if (req.method() === "POST" && table === "studio_conversations") { const row = req.postDataJSON(); const i = chats.findIndex(c => c.id === row.id); if (i < 0) chats.push(row); else chats[i] = row; return route.fulfill({ status: 201, body: "", headers }); }
    if (req.method() === "DELETE" && (table === "studio_creations" || table === "studio_conversations")) { const list = table === "studio_creations" ? creations : chats; const ids = (url.searchParams.get("id") || "").replace(/^(eq|in)\./, "").replace(/[()]/g, "").split(","); for (let i = list.length - 1; i >= 0; i--) if (ids.includes(list[i].id)) list.splice(i, 1); deleted.push({ table, ids }); return route.fulfill({ status: 204, body: "", headers }); }
    if (req.method() !== "GET") return route.fulfill({ status: 201, body: "", headers });
    const rows = data.filter((v: any) => !url.searchParams.has("id") || url.searchParams.get("id") === "eq." + v.id);
    return route.fulfill({ json: req.headers().accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows, headers });
  });
  let made = 0;
  const generated: any[] = [];
  await page.route("**/api/generate", async r => {
    const input = r.request().postDataJSON(); generated.push(input); const batch = Number(input.settings?.batch || 1);
    await new Promise(res => setTimeout(res, opts.generateDelayMs ?? 1500));
    const base = Date.parse(now) + 60_000;
    const items = Array.from({ length: batch }, () => { const n = made++; return { id: "9999999" + n + "-9999-4999-8999-" + String(n).padStart(12, "9"), user_id: A, conversation_id: chat, title: "Result " + (n + 1), prompt: input.prompt, mode: "generate", style: "Auto", persona_id: input.personaId, parent_id: null, image_path: A + "/image-" + n + ".png", status: "ready", favorite: false, settings: { ...settings, batch }, created_at: new Date(base + n * 1000).toISOString(), score: null }; });
    creations.unshift(...items.slice().reverse());
    return r.fulfill({ json: { creations: items, partial: false } });
  });
  await page.route("**/api/analyze", async r => {
    const input = r.request().postDataJSON(), item = creations.find(c => c.id === input.creationId), n = Number(item?.image_path?.match(/image-(\d+)/)?.[1] ?? 0);
    await new Promise(res => setTimeout(res, 300 + n * 250));
    const s = score(scores[n % scores.length], input.title); if (item) item.score = s;
    return r.fulfill({ json: { score: s, creationId: input.creationId } });
  });
  return { creations, chats, deleted, removedFiles, generated };
}

async function openComposer(page: Page) {
  const show = page.getByRole("button", { name: "Show prompt and settings", exact: true }), create = page.getByRole("button", { name: "Create thumbnail", exact: true });
  await expect(show.or(create)).toBeVisible();
  if (await show.isVisible()) await show.click();
}

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`batch 4: four placeholders, verbs + live stage, tap a tile to review it, badge opens the score (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize(size);
    await setup(page, { generateDelayMs: 2500 });
    await page.goto("/");
    await expect(page.locator(".review-summary")).toContainText("Fixture start");
    await openComposer(page);
    await page.getByLabel("Images per request").selectOption("4");
    await page.getByRole("button", { name: "Create thumbnail", exact: true }).click();
    const card = page.getByRole("region", { name: "Thumbnail delivery" });
    await expect(card).toHaveAttribute("data-stage", "generating");
    // One quiet tile per requested image, each sweeping on its own beat.
    await expect(card.locator(".delivery-ghost")).toHaveCount(4);
    const delays = await card.locator(".delivery-ghost .delivery-light").evaluateAll(els => els.map(el => getComputedStyle(el).animationDelay));
    expect(delays).toEqual(["0s", "0.12s", "0.24s", "0.36s"]);
    // Pik + verb are decoration; the live region names the concrete stage.
    const verb = card.locator(".work-status");
    await expect(verb).toHaveAttribute("aria-hidden", "true");
    await expect(verb.locator(".work-pik img")).toBeVisible();
    await expect(card.getByRole("status")).toHaveText("Creating 4 images");
    // The old long helper copy is gone.
    await expect(page.getByText(/Activity animation, not measured|The studio stays available|Writing the prompt with your thumbnail rules/)).toHaveCount(0);
    await page.waitForTimeout(900);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/round2-generating-${size.width}.png` });

    // Images land: four tiles, scoring spinners, then numbers.
    await expect(card.locator(".delivery-result .delivery-tile")).toHaveCount(4, { timeout: 10_000 });
    await expect(card.locator(".delivery-result .score-badge[data-tone=pending]").first()).toBeVisible();
    await expect(card.getByRole("status")).toHaveText(/Scoring \d of 4/);
    await expect(card).toHaveAttribute("data-stage", "ready", { timeout: 15_000 });
    await expect(card.getByRole("status")).toHaveText("Done");
    await expect(card.locator(".delivery-result button.score-badge")).toHaveCount(4);

    // Tiles are buttons: tap the third → selection ring + its score in the panel below.
    const third = card.getByRole("button", { name: /^Review image 3:/ });
    await third.click();
    await expect(third).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator(".delivery-tile[data-selected]")).toHaveCount(1);
    await expect(page.locator(".score-header h2")).toContainText("84");
    await expect(page.getByRole("group", { name: "What's next?" }).getByRole("button", { name: "One-Click Fix" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `evidence/round2-selected-${size.width}.png` });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/round2-tiles-${size.width}.png` });

    // The badge on a tile opens the full score dialog for that image.
    await card.getByRole("button", { name: /^Image 2: Score 58 out of 100/ }).click();
    const dialog = page.getByRole("dialog", { name: "Thumbnail Analysis" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".score-ring")).toHaveAttribute("aria-label", /58/);
    await expect(dialog.locator(".pillar-segments").first().locator("i")).toHaveCount(10);
    await page.screenshot({ path: `evidence/round2-analysis-dialog-${size.width}.png` });
  });
}

test("badge on the canvas opens the analysis dialog; the badge stays a small fraction of the image", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/");
  const badge = page.locator(".review-canvas button.score-badge");
  await expect(badge).toBeVisible();
  const [b, img] = await Promise.all([badge.boundingBox(), page.locator(".review-canvas .result-image").boundingBox()]);
  expect(b!.height).toBeLessThanOrEqual(28);
  expect(b!.width / img!.width).toBeLessThanOrEqual(0.2);
  expect(await badge.evaluate(el => getComputedStyle(el).backdropFilter)).toBe("none");
  await badge.click();
  await expect(page.getByRole("dialog", { name: "Thumbnail Analysis" })).toBeVisible();
});

test("@ opens persona suggestions; arrows and Enter pick one and select it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/");
  await openComposer(page);
  const prompt = page.locator("#thumbnail-prompt");
  await prompt.fill("");
  await prompt.pressSequentially("Shocked face of @");
  const list = page.getByRole("listbox", { name: "Personas" });
  await expect(list).toBeVisible();
  await expect(prompt).toHaveAttribute("aria-autocomplete", "list");
  await expect(list.getByRole("option")).toHaveCount(2);
  await prompt.pressSequentially("Da");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(prompt).toHaveAttribute("aria-activedescendant", await list.getByRole("option").first().getAttribute("id") as string);
  const box = await list.getByRole("option").first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "evidence/round2-mention-390.png" });
  await prompt.press("Escape");
  await expect(list).toHaveCount(0);
  await prompt.pressSequentially("r");
  await expect(list).toHaveCount(0);
  await prompt.fill("Shocked face of ");
  await prompt.pressSequentially("@");
  await expect(list).toBeVisible();
  await prompt.press("ArrowDown");
  await expect(list.getByRole("option", { selected: true })).toContainText("Dana");
  await prompt.press("ArrowUp");
  await expect(list.getByRole("option", { selected: true })).toContainText("Derrick");
  await prompt.press("Enter");
  await expect(prompt).toHaveValue("Shocked face of @Derrick ");
  await expect(list).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change persona: Derrick" })).toBeVisible();
});

test("several personas can be mentioned; each mention shows in the accent colour and goes to Create", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await setup(page, { generateDelayMs: 200 });
  await page.goto("/");
  await openComposer(page);
  const prompt = page.locator("#thumbnail-prompt");
  await prompt.fill("");
  await prompt.pressSequentially("@Der");
  await prompt.press("Enter");
  await prompt.pressSequentially("and @Da");
  await prompt.press("Enter");
  await prompt.pressSequentially("in a podcast");
  await expect(prompt).toHaveValue("@Derrick and @Dana in a podcast");
  await expect(page.getByRole("button", { name: "Change persona: Derrick", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change persona: Dana", exact: true })).toBeVisible();
  const marks = page.locator(".prompt-mirror .prompt-mention");
  await expect(marks).toHaveText(["@Derrick", "@Dana"]);
  const [markColor, accent, textColor] = await page.evaluate(() => [getComputedStyle(document.querySelector(".prompt-mirror .prompt-mention")!).color, getComputedStyle(document.documentElement).getPropertyValue("--accent-400").trim(), getComputedStyle(document.querySelector("#thumbnail-prompt")!).webkitTextFillColor]);
  expect(markColor).toBe("rgb(248, 92, 89)");
  expect(accent).toBe("#f85c59");
  expect(textColor).toBe("rgba(0, 0, 0, 0)");
  // The mirror lines up with the textarea so the coloured words sit exactly under the caret.
  const [box, mirror] = await Promise.all([prompt.boundingBox(), page.locator(".prompt-mirror").boundingBox()]);
  expect(Math.abs(box!.x - mirror!.x)).toBeLessThan(1); expect(Math.abs(box!.y - mirror!.y)).toBeLessThan(1); expect(Math.abs(box!.width - mirror!.width)).toBeLessThan(1);
  await page.screenshot({ path: "evidence/mentions-multi-1440.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(marks).toHaveText(["@Derrick", "@Dana"]);
  const [phoneBox, phoneMirror] = await Promise.all([prompt.boundingBox(), page.locator(".prompt-mirror").boundingBox()]);
  expect(Math.abs(phoneBox!.width - phoneMirror!.width)).toBeLessThan(1);
  await prompt.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "evidence/mentions-multi-390.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Create thumbnail", exact: true }).click();
  await expect.poll(() => fixture.generated.length).toBeGreaterThan(0);
  expect(fixture.generated[0].personaIds).toEqual(["44444444-4444-4444-8444-444444444444", "44444444-4444-4444-8444-444444444445"]);
  // Removing a persona chip drops it and its mention colour.
  await openComposer(page);
  await page.getByRole("button", { name: "Remove persona: Dana", exact: true }).click();
  await expect(page.getByRole("button", { name: "Change persona: Dana", exact: true })).toHaveCount(0);
  await expect(prompt).toHaveValue("@Derrick and Dana in a podcast");
  await expect(page.locator(".prompt-mirror .prompt-mention")).toHaveText(["@Derrick"]);
});

test("deleting a chat removes its thumbnails, their files and the chat after a confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await setup(page);
  await page.goto("/");
  await expect(page.locator(".review-summary")).toContainText("Fixture start");
  await page.getByRole("button", { name: "Delete chat: Fixture chat", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this chat?" });
  await expect(dialog).toContainText("its 1 thumbnail will be deleted");
  await page.screenshot({ path: "evidence/chat-delete-dialog-1440.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.deleted).toHaveLength(0);
  await page.getByRole("button", { name: "Delete chat: Fixture chat", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete this chat?" }).getByRole("button", { name: "Delete chat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open chat: Fixture chat" })).toHaveCount(0);
  expect(fixture.deleted.map(d => d.table)).toEqual(["studio_creations", "studio_conversations"]);
  expect(fixture.deleted[0].ids).toContain("55555555-5555-4555-8555-555555555555");
  await expect.poll(() => fixture.removedFiles.slice().sort()).toEqual([A + "/start.png"]);
  await expect(page.locator(".review-summary")).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`the Styles library never scrolls sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await setup(page);
    await page.goto("/");
    await openComposer(page);
    await page.locator(".composer-tool-group").getByRole("button", { name: "Style", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Library", exact: true }).click();
    await expect(dialog.locator(".style-library-card").first()).toBeVisible();
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => { const d = document.querySelector("dialog")!; const shell = d.querySelector(".dialog-shell")!;
      const cols = getComputedStyle(d.querySelector(".style-library-grid")!).gridTemplateColumns.split(" ").length;
      const truncated = [...d.querySelectorAll(".style-library-card small, .style-library-card strong")].filter(el => el.scrollWidth > el.clientWidth + 1).length;
      return { doc: document.documentElement.scrollWidth, dialog: d.scrollWidth, dialogClient: d.clientWidth, shell: shell.scrollWidth, shellClient: shell.clientWidth, vw: innerWidth, cols, truncated }; });
    expect(m.doc).toBeLessThanOrEqual(m.vw);
    expect(m.dialog).toBeLessThanOrEqual(m.dialogClient);
    expect(m.shell).toBeLessThanOrEqual(m.shellClient);
    expect(m.cols).toBe(width < 340 ? 1 : 2);
    expect(m.truncated).toBe(0);
    await page.screenshot({ path: `evidence/round2-styles-${width}.png` });
  });
}
