import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

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
  const elements:any[]=[];
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
    if (url.pathname.includes("/storage/") && req.method() === "POST" && !url.pathname.includes("/object/sign/")) return route.fulfill({json:{Key:"uploaded"},headers});
    if (url.pathname.includes("/storage/") && req.method() === "POST") { const paths = req.postDataJSON().paths || []; return route.fulfill({ json: paths.map((p: string) => ({ path: p, signedURL: "/object/sign/studio-assets/" + p + "?token=fixture" })), headers }); }
    if (url.pathname.includes("/storage/")) { const n = Number(url.pathname.match(/image-(\d+)\.png/)?.[1] ?? 4); return route.fulfill({ body: pngs[n % pngs.length], contentType: "image/png", headers }); }
    const table = url.pathname.split("/").pop(), data = table === "studio_conversations" ? chats : table === "studio_creations" ? creations : table === "studio_personas" ? personas : table === "studio_elements" ? elements : [];
    if (req.method() === "POST" && table === "studio_conversations") { const row = req.postDataJSON(); const i = chats.findIndex(c => c.id === row.id); if (i < 0) chats.push(row); else chats[i] = row; return route.fulfill({ status: 201, body: "", headers }); }
    if (req.method() === "DELETE" && (table === "studio_creations" || table === "studio_conversations")) { const list = table === "studio_creations" ? creations : chats; const ids = (url.searchParams.get("id") || "").replace(/^(eq|in)\./, "").replace(/[()]/g, "").split(","); for (let i = list.length - 1; i >= 0; i--) if (ids.includes(list[i].id)) list.splice(i, 1); deleted.push({ table, ids }); return route.fulfill({ status: 204, body: "", headers }); }
    if (req.method() !== "GET") return route.fulfill({ status: 201, body: "", headers });
    const rows = data.filter((v: any) => !url.searchParams.has("id") || url.searchParams.get("id") === "eq." + v.id);
    return route.fulfill({ json: req.headers().accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows, headers });
  });
  await page.route("**/api/profiles",async r=>{const input=r.request().postDataJSON();const profile={...input,kind:input.elementKind,id:"66666666-6666-4666-8666-666666666666",created_at:now};elements.push(profile);return r.fulfill({json:{profile}});});
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


for(const width of [1440,390])test(`saved logo element can be selected, mentioned and generated (${width}px)`,async({page})=>{
 await page.setViewportSize({width,height:900});const {generated}=await setup(page);await page.goto('/');await openComposer(page);
 await page.getByRole('button',{name:'Element',exact:true}).click();await page.getByRole('button',{name:'Create element',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('Acme');await page.getByLabel('Element kind',{exact:true}).selectOption('logo');
 const png=await sharp({create:{width:300,height:300,channels:3,background:'#ffc840'}}).png().toBuffer();await page.getByLabel('Profile reference photos').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});
 await expect(page.getByText('1/3 selected',{exact:true})).toBeVisible();await page.screenshot({path:`evidence/elements-dialog-${width}.png`});
 await page.getByRole('button',{name:'Create element',exact:true}).click();await expect(page.getByRole('button',{name:'Change element: Acme'})).toBeVisible();
 const prompt=page.locator('#thumbnail-prompt');await prompt.fill('Show the exact @Ac');await page.getByRole('option').filter({hasText:'Acme'}).click();await expect(page.locator('.prompt-mention')).toHaveText('@Acme');
 await page.screenshot({path:`evidence/elements-chips-${width}.png`});await page.getByRole('button',{name:'Create thumbnail',exact:true}).click();await expect.poll(()=>generated.length).toBe(1);expect(generated[0].elementIds).toEqual(["66666666-6666-4666-8666-666666666666"]);
});
