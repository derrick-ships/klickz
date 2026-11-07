# OpenPikzels original brand assets

Two bespoke stills were generated first with Higgsfield / GPT Image 2.6 Sunburst, visually inspected, then animated with Kling 3.0 standard. These are application branding, not generated user creations, example scores, stock photography or testimonial imagery.

The direction uses the existing design tokens: near-black `#101010`, matte graphite `#181818`, vermilion-red `#df1c2c`, sparse landscape rectangles, practical softbox lighting, tactile powder-coated metal and quiet left-hand space for live type. No baked-in text, logos, fake UI, reaction faces or generic neon effects. Creative Prompt Director supplied the still/motion direction; Higgsfield produced the actual media.

| Scene | Visual concept | Application placement |
| --- | --- | --- |
| Aperture | A red rectangular aperture in front of two graphite thumbnail plates | `/connect` onboarding |
| Signal | One selected red tile among restrained charcoal thumbnail plates | Empty studio; disappears once saved work exists |

## Delivery

`public/brand/` contains self-hosted WebP posters and silent WebM/MP4 clips. The original six web files total about **173 KB**; four responsive poster variants bring the complete set to **198 KB**. Posters are available at 672/960/1344px; the Signal mobile source is 5.1 KB (versus 26.3 KB for the original), and the 960px version is 8.1 KB. The matching poster renders first. Only visible scenes for visitors without reduced-motion/data-saving preferences attach a small motion source. No external video player, tracker, streaming service or generation API is used during playback.

The user explicitly requested removal of Play/Pause. There are no playback controls and no loop: eligible visible scenes play one muted take capped at 4.4 seconds, followed by a 240ms dissolve to the poster. Editing, hidden tabs, leaving the viewport or enabling reduced motion/data saving stop playback. Reduced-motion/data-saving visitors never attach video sources. A blocked autoplay keeps the poster.

The original videos measure 1280×716 and approximately 5.04 seconds, with no audio stream. Web deliveries are 960×538, VP9 WebM with H.264 MP4 fallback. Model framing is close to the requested 16:9; CSS handles responsive crops. Loops are restrained matching-start/end takes, not a claim of mathematically identical endpoint pixels.

Exact prompts, model choices, job IDs, palette, intended placements and cost receipts are in `assets/brand/manifest.json`. Original PNGs/MP4s are retained locally under `assets/brand/originals/` and included in the separate brand-assets ZIP; they are excluded from the deployed site and Git to keep the app light.

## Credit record

- Two medium 1K GPT Image 2.6 stills: 0.5 Higgsfield credits each.
- Two silent five-second Kling 3.0 standard clips: 6.25 credits each.
- Total: **13.5 credits**, confirmed by the account balance changing from 889.25 to 875.75.
- No additional takes, upscales, purchases, subscription changes or unlimited-plan claims were made. These brand assets do not test the application's own OpenAI/Jev credentials.

## Verification

Both generated stills and one-frame-per-second motion contact sheets were visually inspected. FFprobe confirmed dimensions, duration and absence of audio streams. Browser tests exercise real video decoding and time progression, finite autoplay without controls or looping, pause-on-input/preference change, no video source for reduced-motion/data-saving visitors, responsive layout and keyboard focus. Real desktop/mobile screenshots are in `evidence/`.

Brand generation used the connected [Higgsfield](https://higgsfield.ai/) integration and the [Creative Prompt Director](plugin://creative-prompt-director@openai-curated-remote) skill. The existing Next.js/Vercel application stays on its current stack; the optional Higgsfield website framework was not substituted for it.

## Mobile crop/performance correction

The fixed 76px mobile strip was replaced with a reserved 3:1 frame. The still and video share positioning; all five representative phone widths were inspected from actual browser captures, including moving and settled frames. No new generated assets or credits were needed: responsive WebPs are compressed resizes of the existing originals. Initial HTML now exposes the high-priority empty-state poster; the video uses the existing image underneath rather than requesting a duplicate poster.
