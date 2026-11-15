import { App } from "@modelcontextprotocol/ext-apps";

/* ---------- Types (defensive: every field optional) ---------- */
type Pillar = "virality" | "clarity" | "idea" | "curiosity" | "emotion";
type Dimension = {
  score?: number | null;
  observation?: string;
  strength?: string;
  weakness?: string;
  fix?: string;
  missingReason?: string | null;
  confidence?: string;
};
type Evaluation = {
  overall?: number | null;
  partial?: boolean;
  title?: string;
  context?: { title?: string };
  priority?: Pillar;
  dimensions?: Partial<Record<Pillar, Dimension>>;
  warnings?: string[];
};
type Fix = { kind?: string; reason?: string; token?: string; prompt?: string | null };
type View = {
  score?: Evaluation;
  creationId?: string;
  previewUrl?: string | null;
  title?: string;
  fix?: Fix;
  reviewer?: string;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  next?: string;
};

const PILLARS: [Pillar, string][] = [
  ["virality", "Virality"],
  ["clarity", "Clarity"],
  ["idea", "Idea"],
  ["curiosity", "Curiosity"],
  ["emotion", "Emotion"],
];

declare global {
  interface Window {
    __OPENPIKZELS_FIXTURE__?: unknown;
    __OPENPIKZELS_RENDER__?: (structuredContent: unknown, isError?: boolean) => void;
  }
}

const app = new App({ name: "OpenPikzels", version: "2.0.0" }, {});
const root = document.getElementById("root")!;
const live = document.getElementById("live")!;
let current: View | null = null;
let fixRequest: { requestId: string; rescoreRequestId: string } | null = null;
let fixing = false;

/* ---------- DOM helpers (textContent only) ---------- */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
  parent?: Element,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const tone = (n: number | null) => (n == null ? "none" : n < 50 ? "low" : n < 70 ? "mid" : "high");
const say = (msg: string) => (live.textContent = msg);
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ---------- Normalize every tool shape into one view ---------- */
function normalize(sc: any): View | null {
  if (!sc || typeof sc !== "object") return null;
  const creation = sc.creation && typeof sc.creation === "object" ? sc.creation : null;
  const score: Evaluation | undefined =
    sc.score && typeof sc.score === "object" ? sc.score : creation?.score ?? undefined;
  return {
    score,
    creationId: str(sc.creationId) || str(creation?.id) || undefined,
    previewUrl: str(sc.previewUrl) || str(creation?.previewUrl) || null,
    title: str(sc.title) || str(creation?.title) || undefined,
    fix: sc.fix && typeof sc.fix === "object" ? sc.fix : undefined,
    reviewer: str(sc.reviewer) || undefined,
    before: num(sc.before),
    after: num(sc.after),
    delta: num(sc.delta),
    next: str(sc.next) || undefined,
  };
}
const titleOf = (v: View) =>
  str(v.score?.context?.title) || str(v.score?.title) || "";

function weakest(s: Evaluation): [Pillar, string, Dimension] | null {
  const dims = s.dimensions || {};
  const p = s.priority && dims[s.priority] ? PILLARS.find(([k]) => k === s.priority) : undefined;
  if (p) return [p[0], p[1], dims[p[0]]!];
  let best: [Pillar, string, Dimension] | null = null;
  for (const [k, label] of PILLARS) {
    const d = dims[k];
    const n = num(d?.score);
    if (d && n != null && (best == null || n < (num(best[2].score) ?? 101))) best = [k, label, d];
  }
  return best;
}

/* ---------- States ---------- */
function renderLoading(msg = "Scoring your thumbnail…") {
  const card = el("article", "card skeleton");
  card.setAttribute("aria-busy", "true");
  const head = el("div", "head", undefined, card);
  brand(head);
  el("div", "ring-ph", undefined, head);
  el("div", "ph media", undefined, card);
  el("p", "loading-text", msg, card);
  el("div", "ph line", undefined, card);
  el("div", "ph line short", undefined, card);
  root.replaceChildren(card);
  say(msg);
}

function renderMessage(heading: string, body: string, v?: View | null) {
  const card = el("article", "card");
  const head = el("div", "head", undefined, card);
  brand(head);
  if (v?.previewUrl) media(card, v.previewUrl, v.title || "Thumbnail");
  el("h2", "msg-title", heading, card);
  if (body) el("p", "muted", body, card);
  root.replaceChildren(card);
  say(heading);
}

function brand(parent: Element) {
  const b = el("div", "brand", undefined, parent);
  const mark = el("span", "mark", undefined, b);
  mark.setAttribute("aria-hidden", "true");
  el("span", "wordmark", "OpenPikzels", b);
}

function media(parent: Element, url: string, alt: string) {
  const fig = el("div", "media", undefined, parent);
  const img = el("img", undefined, undefined, fig);
  img.src = url;
  img.alt = alt;
  img.decoding = "async";
  img.onerror = () => fig.remove();
}

function ring(parent: Element, s: Evaluation, v: View) {
  const overall = num(s.overall);
  const wrap = el("div", "score " + tone(overall), undefined, parent);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  const C = 2 * Math.PI * 28;
  for (const cls of ["track", "arc"]) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "32");
    c.setAttribute("cy", "32");
    c.setAttribute("r", "28");
    c.setAttribute("class", cls);
    if (cls === "arc") {
      c.style.strokeDasharray = String(C);
      c.style.strokeDashoffset = String(C);
      const target = C * (1 - Math.max(0, Math.min(100, overall ?? 0)) / 100);
      requestAnimationFrame(() => requestAnimationFrame(() => (c.style.strokeDashoffset = String(target))));
    }
    svg.append(c);
  }
  wrap.append(svg);
  const label = el("div", "score-num", overall == null ? (s.partial ? "Partial" : "—") : String(Math.round(overall)), wrap);
  if (overall == null && s.partial) label.classList.add("small");
  wrap.setAttribute(
    "aria-label",
    overall == null ? "Overall score not available" : `Overall score ${Math.round(overall)} out of 100`,
  );
  wrap.setAttribute("role", "img");
  const d = v.delta;
  if (d != null && d !== 0) {
    const delta = el("div", "delta " + (d > 0 ? "up" : "down"), (d > 0 ? "▲" : "▼") + Math.abs(Math.round(d)), parent);
    const before = v.before;
    delta.setAttribute("aria-label", `${d > 0 ? "Up" : "Down"} ${Math.abs(Math.round(d))} points${before != null ? " from " + Math.round(before) : ""}`);
    if (before != null) delta.title = "Before: " + Math.round(before);
  }
}

/* ---------- Main card ---------- */
function render(v: View) {
  current = v;
  const s = v.score!;
  const title = titleOf(v) || str(v.title);
  const scoreTitle = titleOf(v);
  const card = el("article", "card");
  card.setAttribute("aria-label", "Thumbnail analysis");

  // 1. Header
  const head = el("div", "head", undefined, card);
  brand(head);
  const scoreBox = el("div", "score-box", undefined, head);
  ring(scoreBox, s, v);

  // 2. Image
  if (v.previewUrl) media(card, v.previewUrl, title || "Thumbnail");

  // 3. Title
  if (scoreTitle) {
    const t = el("p", "title-line", undefined, card);
    el("span", "muted", "Title: ", t);
    el("span", "title-text", scoreTitle, t);
  } else {
    el("p", "notice", "No title — Idea and Curiosity can't be scored. Send the exact video title.", card);
  }
  if (v.before != null && v.after != null) {
    el("p", "muted small", `Before ${Math.round(v.before)} → after ${Math.round(v.after)}`, card);
  }

  // 4. Holding back
  const w = weakest(s);
  if (w) {
    const hb = el("section", "holding " + tone(num(w[2].score)), undefined, card);
    const top = el("div", "holding-top", undefined, hb);
    el("h2", "eyebrow", "What's holding it back", top);
    el("span", "pill", `${w[1]} ${num(w[2].score) ?? "—"}`, top);
    if (str(w[2].weakness)) el("p", "holding-weak", str(w[2].weakness), hb);
    if (str(w[2].fix)) {
      const f = el("p", "holding-fix", undefined, hb);
      el("strong", undefined, "Fix: ", f);
      f.append(document.createTextNode(str(w[2].fix)));
    }
  }

  // 5. Pillars
  const list = el("section", "pillars", undefined, card);
  list.setAttribute("aria-label", "Scores by pillar");
  for (const [key, label] of PILLARS) {
    const d = s.dimensions?.[key] || {};
    const n = num(d.score);
    const det = el("details", "pillar", undefined, list);
    const sum = el("summary", undefined, undefined, det);
    el("span", "p-name", label, sum);
    if (n == null) {
      el("span", "p-na", "Not assessed", sum);
    } else {
      const bar = el("span", "bar " + tone(n), undefined, sum);
      bar.setAttribute("aria-hidden", "true");
      const fill = el("span", "fill", undefined, bar);
      fill.style.width = Math.max(2, Math.min(100, n)) + "%";
      el("span", "p-num " + tone(n), String(Math.round(n)), sum);
    }
    el("span", "chev", undefined, sum).setAttribute("aria-hidden", "true");
    const body = el("div", "p-body", undefined, det);
    if (n == null) el("p", "muted", str(d.missingReason) || "Not enough information to score this pillar.", body);
    const rows: [string, string][] = [
      ["What we see", str(d.observation)],
      ["Working for you", str(d.strength)],
      ["Holding it back", str(d.weakness)],
      ["Fix", str(d.fix)],
    ];
    for (const [k, val] of rows) {
      if (!val) continue;
      el("h3", "p-k", k, body);
      el("p", "p-v", val, body);
    }
  }

  // 6. Improved prompt
  const fix = v.fix || {};
  const prompt = str(fix.prompt);
  if (prompt) {
    const sec = el("section", "prompt", undefined, card);
    el("h2", "eyebrow", "Improved prompt to iterate", sec);
    el("p", "muted small", "Paste it into ChatGPT with the original image, or let OpenPikzels apply it.", sec);
    const pre = el("pre", "prompt-text", prompt, sec);
    pre.tabIndex = 0;
    pre.setAttribute("aria-label", "Improved prompt");
    const copy = el("button", "btn ghost", "Copy prompt", sec);
    copy.type = "button";
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        copy.textContent = "Copied";
        say("Prompt copied");
      } catch {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        copy.textContent = "Press ⌘C to copy";
        say("Prompt selected. Press Command C to copy.");
      }
      setTimeout(() => (copy.textContent = "Copy prompt"), 2500);
    };
  }

  // 7. Actions
  const actions = el("section", "actions", undefined, card);
  const id = v.creationId || "unknown";
  if (prompt) {
    const b = el("button", "btn primary", "Generate improved version in ChatGPT", actions);
    b.type = "button";
    b.onclick = () =>
      send(
        `Use ChatGPT image generation to edit the OpenPikzels thumbnail shown above (creation ${id}). Apply exactly this prompt:\n\n${prompt}\n\nThen upload the result to OpenPikzels with upload_reference and score it with analyze_thumbnail using the same title "${title}", and show me the before/after scores.`,
        b,
      );
  }
  const kind = str(fix.kind);
  if (kind === "blocked" || kind === "noop") {
    if (str(fix.reason)) el("p", "muted small", str(fix.reason), actions);
  } else if (str(fix.token)) {
    const b = el("button", "btn secondary", fixing ? "Fixing… this takes about a minute" : "Fix it with OpenPikzels (uses image credits)", actions);
    b.type = "button";
    b.disabled = fixing;
    b.onclick = () => void runFix(str(fix.token), b);
  }
  if (!scoreTitle) {
    const b = el("button", "btn secondary", "Add the title", actions);
    b.type = "button";
    b.onclick = () =>
      send(`I'll give you the exact video title. Re-score this thumbnail (creation ${id}) with analyze_thumbnail once I send it.`, b);
  }
  if (!actions.childElementCount) actions.remove();
  el("p", "err", undefined, card).id = "action-error";

  // 9. Footer
  const foot = el("footer", "foot", undefined, card);
  el("span", undefined, "Visual rubric — not a click prediction.", foot);
  if (v.reviewer) el("span", undefined, "Image review: " + v.reviewer, foot);

  root.replaceChildren(card);
  say(num(s.overall) == null ? "Analysis ready" : `Analysis ready: ${Math.round(num(s.overall)!)} out of 100`);
  pushContext(v);
}

/* ---------- Host interactions ---------- */
function setError(msg: string) {
  const e = document.getElementById("action-error");
  if (e) e.textContent = msg;
  say(msg);
}

async function send(text: string, btn: HTMLButtonElement) {
  btn.disabled = true;
  try {
    await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
    say("Sent to ChatGPT");
  } catch {
    setError("Couldn't send that to ChatGPT. Copy the prompt and paste it instead.");
  } finally {
    setTimeout(() => (btn.disabled = false), 1500);
  }
}

async function runFix(token: string, btn: HTMLButtonElement) {
  if (fixing) return;
  fixing = true;
  fixRequest ??= { requestId: uuid(), rescoreRequestId: uuid() };
  btn.disabled = true;
  btn.textContent = "Fixing… this takes about a minute";
  say("Fixing… this takes about a minute");
  try {
    const res: any = await app.callServerTool({
      name: "one_click_fix",
      arguments: { planToken: token, rescore: true, ...fixRequest },
    });
    fixing = false;
    if (res?.isError) throw new Error(textOf(res) || "The fix failed.");
    fixRequest = null;
    const v = normalize(res?.structuredContent);
    if (v?.score) render({ ...v, previewUrl: v.previewUrl || current?.previewUrl, reviewer: v.reviewer || current?.reviewer });
    else renderMessage("Fix started", textOf(res) || "Your improved thumbnail is being generated. Ask ChatGPT to score it when it's ready.", v);
  } catch (e) {
    fixing = false;
    btn.disabled = false;
    btn.textContent = "Retry fix with OpenPikzels";
    setError((e as Error)?.message || "The fix failed. You can retry safely.");
  }
}

function textOf(res: any): string {
  const c = Array.isArray(res?.content) ? res.content : [];
  return c
    .filter((x: any) => x?.type === "text" && typeof x.text === "string")
    .map((x: any) => x.text)
    .join("\n")
    .trim();
}

function pushContext(v: View) {
  const s = v.score || {};
  const w = weakest(s);
  const lines = [
    `## OpenPikzels analysis (creation ${v.creationId || "unknown"})`,
    `Title: ${titleOf(v) || "(none — Idea and Curiosity not scored)"}`,
    `Overall: ${num(s.overall) ?? "not available"}${v.delta != null ? ` (delta ${v.delta > 0 ? "+" : ""}${v.delta} vs ${v.before})` : ""}`,
    ...PILLARS.map(([k, l]) => `- ${l}: ${num(s.dimensions?.[k]?.score) ?? "not assessed"}`),
  ];
  if (w) lines.push(`Holding it back: ${w[1]} — ${str(w[2].weakness)} Fix: ${str(w[2].fix)}`);
  if (str(v.fix?.prompt)) lines.push("Improved prompt:\n```\n" + str(v.fix?.prompt) + "\n```");
  lines.push(`One-click fix token available: ${str(v.fix?.token) ? "yes" : "no"}${v.fix?.kind ? ` (kind: ${v.fix.kind})` : ""}`);
  try {
    void app.updateModelContext({ content: [{ type: "text", text: lines.join("\n") }] }).catch(() => {});
  } catch {
    /* host may not support it */
  }
}

function handleResult(sc: unknown, isError?: boolean, fallbackText = "") {
  const v = normalize(sc);
  if (!isError && v?.score && typeof v.score === "object") return render(v);
  const anySc = sc as any;
  if (!isError && anySc?.jobId && anySc?.creation)
    return renderMessage("Fix started", "Your improved thumbnail is being generated. Ask ChatGPT to score it when it's ready.", v);
  renderMessage(
    isError ? "We couldn't analyze this thumbnail" : "No score yet",
    fallbackText || v?.next || "Try again, or ask ChatGPT to run analyze_thumbnail with the image and the exact video title.",
    v,
  );
}

function applyTheme(theme?: string) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}

window.__OPENPIKZELS_RENDER__ = (sc, isError) => handleResult(sc, isError);

/* ---------- Boot ---------- */
const fixture = window.__OPENPIKZELS_FIXTURE__;
if (fixture) {
  handleResult(fixture);
} else {
  applyTheme();
  renderLoading("Waiting for your thumbnail…");
  app.ontoolinput = () => renderLoading("Scoring your thumbnail…");
  app.ontoolresult = (params: any) => handleResult(params?.structuredContent, !!params?.isError, textOf(params));
  app.onhostcontextchanged = (ctx: any) => {
    if (ctx?.theme) applyTheme(ctx.theme);
  };
  app
    .connect()
    .then(() => {
      try {
        applyTheme(app.getHostContext()?.theme);
      } catch {
        /* ignore */
      }
    })
    .catch(() => renderMessage("Couldn't connect", "Reload the conversation to try again."));
}
