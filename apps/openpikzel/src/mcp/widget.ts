import { scoreTone } from "../lib/score-tone";
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
const tone = (n: number | null) => scoreTone(n);
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
function renderLoading(msg = "Scoring…") {
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

/* ---------- Icons ---------- */
const ICONS = {
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
function icon(name: keyof typeof ICONS): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, val] of Object.entries({ viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }))
    svg.setAttribute(k, val);
  svg.innerHTML = ICONS[name]; // static, trusted markup
  return svg;
}

/* ---------- Main card ---------- */
function render(v: View) {
  current = v;
  const s = v.score!;
  const title = titleOf(v) || str(v.title);
  const scoreTitle = titleOf(v);
  const card = el("article", "card");
  card.setAttribute("aria-label", "Thumbnail analysis");

  // Header
  const head = el("div", "head", undefined, card);
  brand(head);
  const scoreBox = el("div", "score-box", undefined, head);
  ring(scoreBox, s, v);

  // Image
  if (v.previewUrl) media(card, v.previewUrl, title || "Thumbnail");

  // Title
  if (scoreTitle) el("p", "title-line muted small", scoreTitle, card);
  else el("p", "muted small", "Add the video title to score Idea and Curiosity.", card);

  // Fix first
  const w = weakest(s);
  if (w && str(w[2].fix)) {
    const hb = el("section", "holding " + tone(num(w[2].score)), undefined, card);
    const top = el("div", "holding-top", undefined, hb);
    el("h2", "eyebrow", "Fix first", top);
    el("span", "pill", `${w[1]} ${num(w[2].score) ?? "—"}`, top);
    el("p", "holding-fix", str(w[2].fix), hb);
  }

  // Pillars
  const list = el("section", "pillars", undefined, card);
  list.setAttribute("aria-label", "Scores by pillar");
  for (const [key, label] of PILLARS) {
    const d = s.dimensions?.[key] || {};
    const n = num(d.score);
    const det = el("details", "pillar", undefined, list);
    const sum = el("summary", undefined, undefined, det);
    el("span", "p-name", label, sum);
    if (n == null) {
      el("span", "p-na", "Not scored", sum);
    } else {
      const bar = el("span", "bar " + tone(n), undefined, sum);
      bar.setAttribute("aria-hidden", "true");
      const fill = el("span", "fill", undefined, bar);
      fill.style.width = Math.max(2, Math.min(100, n)) + "%";
      el("span", "p-num " + tone(n), String(Math.round(n)), sum);
    }
    el("span", "chev", undefined, sum).setAttribute("aria-hidden", "true");
    const body = el("div", "p-body", undefined, det);
    if (n == null) el("p", "muted", str(d.missingReason) || "Not enough information.", body);
    for (const [k, val] of [["Problem:", str(d.weakness)], ["Fix:", str(d.fix)]] as const) {
      if (!val) continue;
      const p = el("p", "p-v", undefined, body);
      el("strong", undefined, k + " ", p);
      p.append(document.createTextNode(val));
    }
  }

  // Actions
  const fix = v.fix || {};
  const prompt = str(fix.prompt);
  const kind = str(fix.kind);
  const blocked = kind === "blocked" || kind === "noop";
  const token = blocked ? "" : str(fix.token);
  if (blocked && str(fix.reason)) el("p", "muted small", str(fix.reason), card);
  if (token || prompt) {
    const actions = el("section", "actions", undefined, card);
    if (token) {
      const b = el("button", "btn primary", fixing ? "Fixing…" : "One-Click Fix", actions);
      b.type = "button";
      b.disabled = fixing;
      b.onclick = () => void runFix(token, b);
    }
    if (prompt) copyButton(actions, prompt);
  }
  el("p", "err", undefined, card).id = "action-error";

  root.replaceChildren(card);
  say(num(s.overall) == null ? "Analysis ready" : `Analysis ready: ${Math.round(num(s.overall)!)} out of 100`);
  pushContext(v);
}

function copyButton(parent: Element, prompt: string) {
  const LABEL = "Copy improved prompt";
  const b = el("button", "btn icon", undefined, parent);
  b.type = "button";
  b.setAttribute("aria-label", LABEL);
  b.title = LABEL;
  b.append(icon("clipboard"));
  let timer: ReturnType<typeof setTimeout> | undefined;
  b.onclick = async () => {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(prompt);
      b.replaceChildren(icon("check"));
      say("Copied");
      timer = setTimeout(() => b.replaceChildren(icon("clipboard")), 1500);
    } catch {
      let ta = document.getElementById("prompt-fallback") as HTMLTextAreaElement | null;
      if (!ta) {
        ta = el("textarea", undefined, undefined, document.body);
        ta.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0";
        ta.id = "prompt-fallback";
        ta.readOnly = true;
        ta.setAttribute("aria-label", "Improved prompt");
      }
      ta.value = prompt;
      ta.focus();
      ta.select();
      b.setAttribute("aria-label", "Press ⌘C");
      b.title = "Press ⌘C";
      say("Selected. Press ⌘C.");
      timer = setTimeout(() => {
        b.setAttribute("aria-label", LABEL);
        b.title = LABEL;
      }, 4000);
    }
  };
}

/* ---------- Host interactions ---------- */
function setError(msg: string) {
  const e = document.getElementById("action-error");
  if (e) e.textContent = msg;
  say(msg);
}

async function runFix(token: string, btn: HTMLButtonElement) {
  if (fixing) return;
  fixing = true;
  fixRequest ??= { requestId: uuid(), rescoreRequestId: uuid() };
  btn.disabled = true;
  btn.textContent = "Fixing…";
  say("Fixing…");
  try {
    const res: any = await app.callServerTool({
      name: "one_click_fix",
      arguments: { planToken: token, rescore: true, ...fixRequest },
    });
    fixing = false;
    if (res?.isError) throw new Error(textOf(res) || "Fix failed.");
    fixRequest = null;
    const v = normalize(res?.structuredContent);
    if (v?.score) render({ ...v, previewUrl: v.previewUrl || current?.previewUrl });
    else renderMessage("Fix started", "Ask ChatGPT to score it when ready.", v);
  } catch (e) {
    fixing = false;
    btn.disabled = false;
    btn.textContent = "Retry fix";
    setError((e as Error)?.message || "Fix failed. Retry is safe.");
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
  if (w) lines.push(`Fix first: ${w[1]} — ${str(w[2].weakness)} Fix: ${str(w[2].fix)}`);
  if (str(v.fix?.prompt)) lines.push("Improved prompt:\n```\n" + str(v.fix?.prompt) + "\n```");
  lines.push(`One-click fix token available: ${str(v.fix?.token) ? "yes" : "no"}${v.fix?.kind ? ` (kind: ${v.fix.kind})` : ""}`);
  try {
    void app.updateModelContext({ content: [{ type: "text", text: lines.join("\n") }] }).catch(() => {});
  } catch {
    /* host may not support it */
  }
}

function renderStudyStatus(data: any) {
  const card = el("article", "card");
  const head = el("header", "head", undefined, card);
  const brand = el("div", "brand", undefined, head);
  el("span", "mark", undefined, brand).setAttribute("aria-hidden", "true");
  el("span", undefined, "OpenPikzels Pre-Flight", brand);

  const modeLabel =
    data.productionMode === "footage_locked" ? "FOOTAGE LOCKED" : "PRE-SHOOT";
  el("span", "pill", modeLabel, head);

  el(
    "h2",
    "msg-title",
    str(data.titleDraft) || "Pre-Flight Study",
    card,
  );

  const pct = Math.max(0, Math.min(100, Number(data.progressPct) || 0));
  const statusBox = el("section", "holding mid", undefined, card);
  const top = el("div", "holding-top", undefined, statusBox);
  el("span", "eyebrow", `${str(data.status || "running").toUpperCase()} · ${pct}%`, top);
  el("p", "holding-fix", str(data.currentMessage) || "Running triangulation…", statusBox);

  const barWrap = el("div", "bar mid", undefined, statusBox);
  const fill = el("span", "fill", undefined, barWrap);
  fill.style.width = `${pct}%`;

  if (str(data.errorMessage)) {
    el("p", "err", str(data.errorMessage), card);
  }

  const opts = Array.isArray(data.options) ? data.options : [];
  if (opts.length) {
    const grid = el("div", "pf-grid", undefined, card);
    for (const o of opts) {
      const item = el("div", "pf-opt", undefined, grid);
      if (str(o.imageUrl)) {
        const media = el("div", "media", undefined, item);
        const img = el("img", undefined, undefined, media);
        img.src = str(o.imageUrl);
        img.alt = `Option ${str(o.optionKey)}`;
      }
      const meta = el("div", "pf-opt-meta", undefined, item);
      el(
        "strong",
        undefined,
        `Option ${str(o.optionKey)}${o.isUserDraft ? " (Draft)" : ""}${o.overallScore != null ? ` · ${o.overallScore}/100` : ""}`,
        meta,
      );
      el("p", "small muted", str(o.title), meta);
    }
  }

  const actions = el("div", "actions", undefined, card);
  if (data.report?.slug) {
    const openRep = el("button", "btn primary", "Load Executive Report", actions);
    openRep.type = "button";
    openRep.onclick = async () => {
      openRep.disabled = true;
      openRep.textContent = "Loading…";
      try {
        const res: any = await app.callServerTool({
          name: "get_preflight_report",
          arguments: { slug: data.report.slug },
        });
        if (!res?.isError && res?.structuredContent) {
          handleResult(res.structuredContent, false, textOf(res));
          return;
        }
      } catch {
        /* ignore */
      }
      openRep.disabled = false;
      openRep.textContent = "Load Executive Report";
    };
  } else {
    const refreshBtn = el("button", "btn primary", "Refresh status", actions);
    refreshBtn.type = "button";
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing…";
      try {
        const res: any = await app.callServerTool({
          name: "get_study_status",
          arguments: { id: str(data.runId) || str(data.studyId) },
        });
        if (!res?.isError && res?.structuredContent) {
          handleResult(res.structuredContent, false, textOf(res));
          return;
        }
      } catch {
        /* ignore */
      }
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh status";
    };
  }

  el("p", "err", "", card).id = "action-error";
  root.replaceChildren(card);
}

function renderPreflightReport(data: any) {
  const rep = data.report;
  if (!rep || typeof rep !== "object") {
    return renderMessage("Report unavailable", "Could not read report data.");
  }
  const v = rep.verdict || {};
  const verdictCode = str(v.code) || "ITERATE";
  const verdictTone =
    verdictCode === "SHIP" ? "high" : verdictCode === "RETHINK" ? "low" : "mid";

  const card = el("article", "card");
  const head = el("header", "head", undefined, card);
  const brand = el("div", "brand", undefined, head);
  el("span", "mark", undefined, brand).setAttribute("aria-hidden", "true");
  el("span", undefined, "OpenPikzels Pre-Flight", brand);
  el(
    "span",
    "pill",
    rep.productionMode === "footage_locked" ? "FOOTAGE LOCKED" : "PRE-SHOOT",
    head,
  );

  // Verdict Banner
  const verdictBox = el("section", `holding ${verdictTone}`, undefined, card);
  const vTop = el("div", "holding-top", undefined, verdictBox);
  el("span", "eyebrow", `${verdictCode} · ${str(rep.channelTitle)}`, vTop);
  el(
    "span",
    "pill",
    v.winningOptionKey ? `Winner: Option ${v.winningOptionKey}` : "No Winner",
    vTop,
  );
  el("p", "holding-fix", str(v.headline) || str(rep.studyTitleDraft), verdictBox);

  // Click Share Bars
  const share = v.clickShare || {};
  const shareSection = el("section", "pillars", undefined, card);
  const shareRows: [string, number, string][] = [
    ["Option A", Number(share.A?.pct) || 0, v.winningOptionKey === "A" ? "high" : "mid"],
    ["Option B", Number(share.B?.pct) || 0, v.winningOptionKey === "B" ? "high" : "mid"],
    ["Option C", Number(share.C?.pct) || 0, v.winningOptionKey === "C" ? "high" : "mid"],
    ["Keep Scrolling", Number(share.none_keep_scrolling?.pct) || 0, "low"],
  ];
  for (const [label, pct, t] of shareRows) {
    const row = el("div", "pf-share-row", undefined, shareSection);
    el("span", "p-name small", label, row);
    const bar = el("div", `bar ${t}`, undefined, row);
    const fill = el("span", "fill", undefined, bar);
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    el("span", `p-num small ${t}`, `${pct}%`, row);
  }

  // Retention Cliff Warning
  if (v.retentionCliff?.summary) {
    const sev = str(v.retentionCliff.severity).toLowerCase();
    const sevTone = sev === "high" ? "low" : sev === "low" ? "high" : "mid";
    const cliff = el("section", `holding ${sevTone}`, undefined, card);
    el(
      "span",
      "eyebrow",
      `Retention Cliff (${sev.toUpperCase() || "MEDIUM"})`,
      cliff,
    );
    el("p", "small", str(v.retentionCliff.summary), cliff);
  }

  // 3-Option Side-by-Side Packaging Matrix
  const matrix = Array.isArray(rep.packagingMatrix) ? rep.packagingMatrix : [];
  if (matrix.length) {
    const grid = el("div", "pf-grid", undefined, card);
    for (const opt of matrix) {
      const isWin = v.winningOptionKey === opt.optionKey;
      const box = el("div", `pf-opt${isWin ? " win" : ""}`, undefined, grid);
      if (str(opt.imageUrl)) {
        const media = el("div", "media", undefined, box);
        const img = el("img", undefined, undefined, media);
        img.src = str(opt.imageUrl);
        img.alt = `Option ${str(opt.optionKey)}: ${str(opt.title)}`;
      }
      const meta = el("div", "pf-opt-meta", undefined, box);
      el(
        "strong",
        "small",
        `Option ${str(opt.optionKey)}${opt.isUserDraft ? " · Draft" : ""}${isWin ? " ★" : ""}`,
        meta,
      );
      el("p", "small", str(opt.title), meta);
      const scoreVal = opt.klickzScore?.overall;
      el(
        "p",
        "small muted",
        `Minds: ${Number(opt.voteSharePct) || 0}% · Klickz: ${scoreVal != null ? `${scoreVal}/100` : "N/A"}`,
        meta,
      );
      if (str(opt.designerRedline?.primaryFix)) {
        el(
          "p",
          "small muted",
          `Redline: ${str(opt.designerRedline.primaryFix)}`,
          meta,
        );
      }
    }
  }

  // Angle / Script Diagnosis highlight
  const fl = rep.angleDiagnosis?.footageLockedPlan;
  const ps = rep.angleDiagnosis?.preShootPlan;
  if (fl?.cold_open_pull_quote?.verbatim_quote) {
    const q = el("section", "pf-quote", undefined, card);
    el("span", "eyebrow", "Cold-Open Pull Quote (Zero-Reshoot)", q);
    el("p", "small", `"${str(fl.cold_open_pull_quote.verbatim_quote)}"`, q);
    if (str(fl.cold_open_pull_quote.editor_cut_instruction)) {
      el(
        "p",
        "small muted",
        `Cut: ${str(fl.cold_open_pull_quote.editor_cut_instruction)}`,
        q,
      );
    }
  } else if (ps?.rewritten_title) {
    const q = el("section", "pf-quote", undefined, card);
    el("span", "eyebrow", "Proposed Angle Rewrite (Pre-Shoot)", q);
    el("p", "small", str(ps.rewritten_title), q);
    if (str(ps.proposed_angle_thesis)) {
      el("p", "small muted", str(ps.proposed_angle_thesis), q);
    }
  }

  // Action buttons
  const actions = el("div", "actions", undefined, card);
  const winKey = v.winningOptionKey || "A";
  const promoteBtn = el(
    "button",
    "btn primary",
    `Promote Option ${winKey} to Studio`,
    actions,
  );
  promoteBtn.type = "button";
  promoteBtn.onclick = async () => {
    promoteBtn.disabled = true;
    promoteBtn.textContent = "Promoting…";
    try {
      const res: any = await app.callServerTool({
        name: "promote_option_to_studio",
        arguments: { slug: str(data.slug), optionKey: winKey },
      });
      if (res?.isError) throw new Error(textOf(res) || "Could not promote.");
      promoteBtn.textContent = "Promoted to Studio ✓";
      say(`Option ${winKey} promoted to Quick Studio.`);
    } catch (e) {
      promoteBtn.disabled = false;
      promoteBtn.textContent = `Promote Option ${winKey} to Studio`;
      setError((e as Error)?.message || "Could not promote option.");
    }
  };

  if (str(data.reportUrl)) {
    const link = el("a", "btn secondary", "Open Report", actions);
    link.href = str(data.reportUrl);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  el("p", "err", "", card).id = "action-error";
  root.replaceChildren(card);

  try {
    const ctxLines = [
      `## OpenPikzels Executive Pre-Flight Report (${str(data.slug)})`,
      `Verdict: ${verdictCode} — ${str(v.headline)}`,
      `Click Share: A ${share.A?.pct ?? 0}%, B ${share.B?.pct ?? 0}%, C ${share.C?.pct ?? 0}%, Keep Scrolling ${share.none_keep_scrolling?.pct ?? 0}%`,
      `Report URL: ${str(data.reportUrl)}`,
    ];
    void app
      .updateModelContext({ content: [{ type: "text", text: ctxLines.join("\n") }] })
      .catch(() => {});
  } catch {
    /* ignore */
  }
}

function handleResult(sc: unknown, isError?: boolean, fallbackText = "") {
  const anySc = sc as any;
  if (!isError && anySc?.kind === "preflight_report" && anySc?.report) {
    return renderPreflightReport(anySc);
  }
  if (!isError && anySc?.kind === "study_status") {
    return renderStudyStatus(anySc);
  }
  const v = normalize(sc);
  if (!isError && v?.score && typeof v.score === "object") return render(v);
  if (!isError && anySc?.jobId && anySc?.creation)
    return renderMessage("Fix started", "Ask ChatGPT to score it when ready.", v);
  renderMessage(
    isError ? "Couldn't complete this action" : "No result yet",
    fallbackText || v?.next || "Try again.",
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
  renderLoading();
  app.ontoolinput = () => renderLoading();
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
    .catch(() => renderMessage("Couldn't connect", "Reload to try again."));
}
