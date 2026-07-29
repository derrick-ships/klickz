---
name: yt-thumbnail-generator-reference
source: https://youtubethumbnailgenerator-pearl.vercel.app/
scraped: 2026-07-29
scraped_by: Claude (ship-os), live browser session — DOM + computed styles + rendered screenshot
status: verified against the live app; every item below was read off the running page
---

# Reference teardown — "YT Thumbnail Generator"

Scraped live. This is the closest public analogue to Klickz. Read it as **the floor**, not the
target: it maps what a competent single-file thumbnail editor covers, and — more usefully —
where it stops.

## What it actually is

A **single-page, zero-backend thumbnail editor** with a bolted-on prompt builder. Two tabs.
Everything runs client-side; nothing is stored; there is no account, no pricing, no auth,
no persistence.

`verified:` no `<form action>`, no XHR endpoints, no auth UI anywhere on either tab.

## Tech stack (verified from the live DOM)

| Fact | Evidence |
|---|---|
| React 18.2.0 UMD, loaded from cdnjs | `<script src=".../react/18.2.0/umd/react.production.min.js">` |
| `babel-standalone` 7.23.9 — **JSX transpiled in the browser** | `<script src=".../babel-standalone/7.23.9/babel.min.js">` |
| No Next.js, no Vite, no bundler | `#__NEXT_DATA__` absent; no `type=module` asset script; mounts on `#root` |
| Rendering: one `<canvas width=1280 height=720>` | single canvas node in DOM |
| UI font: `Inter, system-ui, sans-serif` | computed style |
| Page canvas: `#111111` bg, `#ffffff` ink | `getComputedStyle(body)` |
| Hosting: Vercel | domain |

**The headline architectural fact:** it has no build step. One HTML file, CDN React, in-browser
Babel. That's why it ships fast and why it can't grow — no module system, no tests, no types,
no server, so no scoring, no accounts, no API, no MCP.

## Tab 1 — Templates (the editor)

This is the real product. Left rail of controls, live canvas preview, one export button.

**TEMPLATE** — 8 presets, shown as thumbnail cards:
Bold Split · Gradient Sweep · Diagonal Slash · Spotlight · Full Bleed · Minimal Clean ·
Banner Bar · Circle Frame

**COLORS** — 14 preset duotone swatches, plus 3 pickers, each paired with a hex text field:
- Background — default `#1a1a1a`
- Accent — default `#FF0000`
- Text — default `#FFFFFF`

**TEXT** — 3 fields: Title (`YOUR TITLE HERE`), Subtitle (`Your subtitle goes here`), Badge (`NEW`)

**FONT** — 8 display faces: Oswald · Anton · Bebas Neue · Big Shoulders · League Spartan ·
Montserrat ExtraBold · Poppins ExtraBold · Lato Bold

**TEXT EFFECT** — 6: None · Outline · Thick Outline · Drop Shadow · Glow · Block Shadow

**PERSON** — toggle `Show Person`, image upload, then:
- Scale — range `30–180`, default `100%`
- Move X — range `−400…400`, default `0px`
- Move Y — range `−300…300`, default `0px`

**LOGO** — toggle `Show Logo`, upload, then:
- Size — range `24–120`, default `50px`
- Opacity — range `5–100`, default `100%`
- Position — Bottom Left · Bottom Right · Top Right

**BACKGROUND IMAGE (OPTIONAL)** — single upload slot.

**Export** — `Download PNG`, canvas locked at 1280 × 720.

## Tab 2 — AI Backgrounds (a prompt builder, *not* a generator)

Critical to read correctly: **this tab generates no images.** It composes a text prompt you
copy into someone else's tool, then manually bring the result back. `verified:` the tab's own
Workflow block spells out the 7-step round trip.

**Step 1 — Video Topic**: free-text "what's the video about?" plus Background/Accent brand colors,
which get interpolated into the prompt ("These colors are injected into the prompt so your AI
background matches your brand").

**Step 2 — Background Style** — 11 options:
Cinematic Lighting · Abstract Gradient · Neon Glow · Bokeh Lights · Textured Surface ·
Explosive Energy · Flat Abstract · Flat Duotone · Flat Pattern · Studio Clean · Retro / VHS
(plus an `Add Icon to Background` toggle)

**Step 3 — Complexity** — a Clean ↔ Rich slider. Clean = "Minimal background with space for
text + person overlay".

**Step 4 — AI Tool** — DALL·E · Midjourney · Gemini. Switching target changes the emitted
suffix flags.

**Emitted prompt shape** (captured verbatim from the running app, Cinematic + Midjourney):

```
STYLE: Cinematic Lighting — Dark studio environment with dramatic directional lighting from
one side. Colored gel light (accent color) creating rim light effect. Deep shadows. Empty
center for subject placement. Smooth gradient falloff.
BRAND COLORS: Use #FF0000 as the primary accent color and #1a1a1a as the base/dark tone.
The background should feel cohesive with these colors.
RULES:
- No people, no faces, no figures
- No text, no words, no letters, no typography
- Simple composition with generous negative space
- Clean, uncluttered — leave room for a person and text to be composited on top
- 16:9 aspect ratio, 1280×720px

--ar 16:9 --s 50 --no text, words, letters, typography, people, faces, figures, clutter, busy --style raw
```

**The stated workflow** — 7 manual steps: copy prompt → paste into Midjourney → generate →
download → switch tabs → upload as Background Image → composite person/text/logo → export.

## Visual language

Dark app chrome (`#111` canvas), white ink, YouTube red (`#FF0000`) as the single accent and the
only button fill. Left control rail on a slightly-lifted dark surface, uppercase micro-labels as
section heads (`TEMPLATE`, `COLORS`, `TEXT`, `FONT`), template cards as small rendered previews
with a red border marking the active one, and a large centered red pill `Download PNG` under
the canvas. It is competent and unremarkable — a tool skin, not a brand.

Note the collision worth deciding on: this reference is red-accent-on-dark; the design language
already in `References/DESIGN-framer.md` is white-pill-on-near-black with blue as a signal-only
accent and gradient spotlight cards as the atmosphere device. **They are not the same system.**

## What it does NOT have — the whole Klickz opportunity

Measured against the Klickz blurb ("inspiration templates, virality scoring, reusable people and
poses, plus CLI, API and MCP access"), the reference is missing:

| Klickz promise | Reference status |
|---|---|
| Actual AI generation | ❌ prompt builder only; manual copy-paste round trip to a third-party tool |
| Virality scoring | ❌ absent — no scoring, ranking, or feedback of any kind |
| Reusable people / poses | ❌ upload-per-session only; nothing persists, no library |
| Inspiration templates (real ones) | ⚠️ 8 hardcoded geometric layouts; no library, no imports, no real-world examples |
| CLI | ❌ no build system to hang one off |
| API | ❌ zero backend |
| MCP access | ❌ n/a |
| Accounts / saved projects / history | ❌ nothing persists across reload |
| Multiple export sizes, A/B variants, batch | ❌ single 1280×720 PNG, one at a time |

## Read-across for Klickz

1. **Steal the control taxonomy.** Template → Colors → Text → Font → Effect → Person → Logo →
   Background is a genuinely good decomposition of a thumbnail. The ranges are sane
   (person scale 30–180%, logo 24–120px). Start there rather than re-deriving it.
2. **The canvas contract is the same**: 1280×720, PNG out. Keep it, then add the sizes the
   reference lacks.
3. **The prompt-builder tab is the tell.** The reference stops exactly where the hard part
   begins — it hands you a prompt and asks you to leave. Klickz's differentiation is closing
   that loop in-app, then scoring the result.
4. **Its architecture is a dead end for Klickz.** CDN React + in-browser Babel cannot carry
   accounts, scoring, a people library, an API, or MCP. Klickz needs a real stack from commit
   one; do not mirror this one.

## Honesty block

- **Verified:** everything under Tech stack, both tabs' full control inventories, the emitted
  prompt text, colors, and the absence of auth/pricing/backend — all read from the live running
  app in this session (DOM query + computed styles + rendered screenshot).
- **Assumed:** that no hidden routes exist beyond the two tabs. Only `/` was exercised; no
  sitemap or route manifest was checked.
- **Couldn't verify:** the app's source repo (not linked from the page), and whether the
  Complexity slider changes anything beyond prompt wording — only the Clean end was rendered.
