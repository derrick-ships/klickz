import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

const built = await build({
  entryPoints: ["src/mcp/widget.ts"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: "es2022",
});

const css = `
:root,[data-theme=dark]{--bg:#212121;--surface:#2a2a2a;--surface-2:#303030;--line:rgba(255,255,255,.09);--fg:#f4f4f4;--muted:#b4b4b4;--track:rgba(255,255,255,.12);--low:#ff6b6b;--mid:#f5b843;--high:#4cc38a;--low-bg:rgba(255,107,107,.12);--mid-bg:rgba(245,184,67,.12);--high-bg:rgba(76,195,138,.12);--primary-bg:#f4f4f4;--primary-fg:#141414;--focus:#7aa7ff;--brand:#E5484D;color-scheme:dark}
[data-theme=light]{--bg:#ffffff;--surface:#f7f7f8;--surface-2:#efeff1;--line:rgba(0,0,0,.08);--fg:#0d0d0d;--muted:#5d5d5d;--track:rgba(0,0,0,.09);--low:#c4282d;--mid:#a05a00;--high:#18794e;--low-bg:#fdecec;--mid-bg:#fdf3e1;--high-bg:#e6f5ed;--primary-bg:#0d0d0d;--primary-fg:#ffffff;--focus:#2563eb;color-scheme:light}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:15px/1.5 -apple-system,"SF Pro Text",Inter,system-ui,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
#root{max-width:760px;margin:0 auto;padding:12px}
.card{display:flex;flex-direction:column;gap:12px;min-width:0}
h2,h3,p{margin:0}
.muted{color:var(--muted)}.small{font-size:13px}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;letter-spacing:-.01em}
.mark{width:10px;height:10px;border-radius:2px;background:var(--brand);flex:none}

.score-box{display:flex;align-items:center;gap:10px}
.score{position:relative;width:64px;height:64px;flex:none}
.score svg{width:64px;height:64px;transform:rotate(-90deg)}
.score circle{fill:none;stroke-width:6}
.score .track{stroke:var(--track)}
.score .arc{stroke:var(--muted);stroke-linecap:round;transition:stroke-dashoffset .4s ease-out}
.score.low .arc{stroke:var(--low)}.score.mid .arc{stroke:var(--mid)}.score.high .arc{stroke:var(--high)}
.score-num{position:absolute;inset:0;display:grid;place-items:center;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.score-num.small{font-size:12px;font-weight:600}
.delta{font-weight:700;font-size:14px;padding:4px 8px;border-radius:999px;font-variant-numeric:tabular-nums}
.delta.up{color:var(--high);background:var(--high-bg)}.delta.down{color:var(--low);background:var(--low-bg)}
.media{border-radius:14px;overflow:hidden;background:var(--surface);aspect-ratio:16/9}
.media img{display:block;width:100%;height:100%;object-fit:cover}
.title-line{overflow-wrap:anywhere;margin-top:-4px}
.eyebrow{font-size:14px;font-weight:600;color:var(--muted)}
.holding{border-radius:14px;padding:12px 14px;background:var(--surface);display:flex;flex-direction:column;gap:8px;box-shadow:inset 3px 0 0 var(--muted)}
.holding.low{background:var(--low-bg);box-shadow:inset 3px 0 0 var(--low)}.holding.mid{background:var(--mid-bg);box-shadow:inset 3px 0 0 var(--mid)}.holding.high{background:var(--high-bg);box-shadow:inset 3px 0 0 var(--high)}
.holding-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.holding .eyebrow{color:var(--fg)}
.pill{font-size:13px;font-weight:600;padding:2px 10px;border-radius:999px;background:var(--bg);font-variant-numeric:tabular-nums}
.holding-fix{color:var(--fg);font-weight:500;overflow-wrap:anywhere}
.pillars{display:flex;flex-direction:column;background:var(--surface);border-radius:14px;overflow:hidden}
.pillar+.pillar{border-top:1px solid var(--line)}
.pillar summary{list-style:none;display:grid;grid-template-columns:minmax(76px,auto) 1fr 32px 16px;align-items:center;gap:12px;min-height:44px;padding:4px 14px;cursor:pointer}
.pillar summary::-webkit-details-marker{display:none}
.p-name{font-weight:500}
.p-na{grid-column:2/4;color:var(--muted);font-size:14px;text-align:right}
.bar{height:6px;border-radius:999px;background:var(--track);overflow:hidden}
.bar .fill{display:block;height:100%;border-radius:inherit;background:var(--muted)}
.bar.low .fill{background:var(--low)}.bar.mid .fill{background:var(--mid)}.bar.high .fill{background:var(--high)}
.p-num{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.p-num.low{color:var(--low)}.p-num.mid{color:var(--mid)}.p-num.high{color:var(--high)}
.chev{width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg) translate(-2px,-2px);justify-self:end}
.pillar[open] .chev{transform:rotate(-135deg) translate(-2px,-2px)}
.p-body{padding:0 14px 12px;display:flex;flex-direction:column;gap:6px;font-size:14px}
.p-v{overflow-wrap:anywhere;color:var(--muted)}.p-v strong{color:var(--fg);font-weight:600}
.actions{display:flex;gap:8px;align-items:stretch}
.btn{appearance:none;min-height:44px;border:0;border-radius:12px;padding:10px 18px;font-family:inherit;font-size:15px;font-weight:600;line-height:1.3;cursor:pointer;flex:1 1 auto;min-width:0;text-align:center}
.btn.primary{background:var(--primary-bg);color:var(--primary-fg)}
.btn.secondary{background:var(--surface-2);color:var(--fg);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn.icon{flex:none;width:44px;height:44px;padding:0;display:grid;place-items:center;background:var(--surface-2);color:var(--fg);border-radius:12px}.btn.icon:focus-visible{border-radius:12px}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.pf-opt{background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--line);display:flex;flex-direction:column}
.pf-opt.win{border-color:var(--high);box-shadow:0 0 0 1px var(--high)}
.pf-opt-meta{padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.pf-share-row{display:grid;grid-template-columns:112px 1fr 44px;align-items:center;gap:10px;padding:8px 14px}
.pf-share-row+.pf-share-row{border-top:1px solid var(--line)}
.pf-quote{background:var(--surface);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;border:1px solid var(--line)}
.btn:hover:not(:disabled){filter:brightness(.94)}
[data-theme=dark] .btn:hover:not(:disabled){filter:brightness(1.12)}
.btn:disabled{opacity:.55;cursor:default}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:8px}
.btn:focus-visible{border-radius:12px}
.err{color:var(--low);font-size:14px}.err:empty{display:none}
.msg-title{font-size:17px;font-weight:600}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ring-ph{width:64px;height:64px;border-radius:50%;border:6px solid var(--track)}
.ph{background:var(--surface);border-radius:12px}
.ph.media{aspect-ratio:16/9;border-radius:14px}
.ph.line{height:14px}.ph.line.short{width:60%}
.loading-text{color:var(--muted);font-weight:500}
.skeleton .ph,.skeleton .ring-ph{animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{50%{opacity:.5}}
@media (min-width:560px){#root{padding:16px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`.replace(/\n/g, "");

const html = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenPikzels Workspace</title><style>${css}</style></head><body><main id="root"></main><p id="live" class="sr" role="status" aria-live="polite"></p><script>${built.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;

await writeFile(
  "src/lib/widget.generated.ts",
  "// Generated by scripts/build-widget.mjs. No credentials are embedded.\nexport const widgetHtml = " +
    JSON.stringify(html) +
    ";\n",
);
