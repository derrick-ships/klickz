# Klickz

AI thumbnail maker that keeps you in control. **Internal tool** — no accounts, no billing, nothing leaves your browser.

Everything runs client-side: images are composited onto a `<canvas>` at 1280×720 and exported as PNG. Saved people live in `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The editor is the only route.

```bash
npm test        # layout logic, 7 assertions, no browser needed
npm run build   # production build
npm start       # serve the production build
```

`npm test` runs `node --test lib/layout.test.ts` directly — Node 24 strips TypeScript natively, so there is no `tsx` or `ts-node` in the dependency tree.

**Requires Node 22.6+** for native type stripping. Verified on v24.13.0.

## What it does

- **8 templates** — Bold Split, Gradient Sweep, Diagonal Slash, Spotlight, Full Bleed, Minimal Clean, Banner Bar, Circle Frame
- **Colors** — 14 duotone presets plus background / accent / text pickers with hex entry
- **Text** — title, subtitle, badge; 8 display fonts; 6 effects (outline, thick outline, drop shadow, glow, block shadow, none)
- **People library** — upload a person once, save them, and reuse them later *with their scale and position intact*. This is the thing the tool exists for: the free alternatives forget everything on reload.
- **Logo** — size, opacity, three corner positions
- **Background image** — optional; templates adapt so they don't paint over it
- **Export** — PNG at exactly 1280×720

## Layout

```
app/
  layout.tsx      Google Fonts link + root shell
  page.tsx        editor state, people-library handlers
  globals.css     Tailwind v4 + design tokens
components/
  ControlRail.tsx left rail; template cards are real miniatures
  Preview.tsx     canvas, font loading, PNG export
  ui.tsx          slider/toggle/segmented/swatch/colour primitives
lib/
  templates.ts    types, font table, the 8 templates
  render.ts       the canvas renderer
  layout.ts       pure text fitting and wrapping
  layout.test.ts  the test
  people.ts       localStorage people library
```

### Why these boundaries

`lib/layout.ts` takes an **injected** measure function instead of reaching for a 2D context. That is the whole reason the text-fitting logic can be tested in Node with no DOM and no canvas polyfill — the test supplies synthetic metrics (`width = length × size × 0.5`) and asserts on real behaviour.

`lib/render.ts` is **synchronous**. Every image and font must be loaded before it runs, which is `Preview.tsx`'s job. That keeps the preview redrawing in a single frame on every keystroke with no async tearing.

Template miniatures in the control rail call the same `paint()` function as the full renderer, scaled down. There is no second set of hand-drawn previews to drift out of sync.

## Design

Follows `References/DESIGN-framer.md` — near-black canvas, white pill CTAs, surface lift for hierarchy, `#0099ff` as a signal colour for focus only.

**The UI contains no YouTube red.** That is deliberate, not an oversight. The accent red you see belongs to the *thumbnail being edited*, never to the app chrome around it. See DEC-002 in the project's decision log before changing it.

The design file documents a marketing site, so it specifies no slider, toggle, or segmented control. Those are authored in `components/ui.tsx` to extend the same system: selection reads as surface lift, never as a chromatic fill.

## Fonts

Display faces load from Google Fonts by their real family names via a plain `<link>`, not `next/font` — `next/font` rewrites families to hashed CSS variables, which `ctx.font` cannot resolve. All eight are open-source. GT Walsheim from the design system is licensed and is not used anywhere.

## Storage

One key, `klickz.people.v1`:

```
{ id, name, src, scale, x, y }
```

`src` is a PNG data URL. PNG rather than JPEG because person cutouts need their alpha channel. Uploads are downscaled to 900px tall before storage — a raw phone photo is several MB and two would exhaust the ~5MB budget.

Ceiling is roughly 5–10 saved people. IndexedDB is the upgrade path if that ever bites; quota failures surface as a visible notice rather than silently dropping data.

## Branches

```
feature/<name> → dev → staging → main
```

Main is production and takes no direct pushes. Work lands through a PR every time.

## Not built yet

AI background generation, virality scoring, CLI, API, and MCP access are specified in the project PRD but are not in this build. The MVP is the editor loop: template, text, person, export.
