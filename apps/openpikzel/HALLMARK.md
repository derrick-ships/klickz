# Hallmark — OpenPikzels slop review

## Read

**Job:** creators review their actual thumbnail, understand available visual evidence and choose edit, score, resize or export.

**What works and stays:** the explicit red/dark brief, original graphite/red imagery, compact relief controls and static dotted background. These are user-pinned choices, not reasons to deal a different theme. The selected Review Studio makes the actual image lead; desktop evidence remains beside it and mobile stacks in reading order.

**What read as generated:** numbered eyebrows repeating the headings, a Unicode account-logo glyph, middle-dot metadata and style values copied outside the design tokens. The last item is mostly maintainability debt, not80 separate visual defects.

**What was broken:** nested Escape/focus ownership and whole-button keyboard scaling; both now have regressions and are corrected. Blank/failed preview feedback and draft-only controls are kept distinct from image review.

## Method and scope

Hallmark2.0.0 app scope with the existing DESIGN.md locked. No theme draw, marketing hero, stock assets, fabricated metrics or testimonial material. Static source plus actual sloplint --render for generate, analyze and Connections at1280×800,1440×900,1920×1080 and375px. Selected-image/score/feed states were also rendered by Playwright and opened for visual review at320/375/390/768/1024/1280/1440/1920. Their scores and title are explicit local test fixtures, not provider validation.

An independent model reviewer followed Hallmark’s finish prompt with source and actual selected-state images, returned **ship**, and found no concrete finish defect. It preserved the pinned aesthetic and noted that the former empty Analyze view exposes fields directly while selected-image review now uses progressive disclosure. This was not a human usability study or a physical-device review.

## Mechanical results

| Measure | Before | Final audited build |
| --- | --- | --- |
| Source files |12|14|
| Floor FAIL |107|0|
| Open REFLEX |4|0|
| WARN |1|0|
| WAIVED occurrences |232|233|
| ANSWERED Finish |2|2|
| DISMISSED |5|6|
| Render tier |ran|ran|

Counts are raw Hallmark output, not a quality score. The233 waived occurrences come from two named reasons:232 instances under the pre-existing compact-spacing waiver24b, following the user’s pinned editor, and one39b image-upload input whose112px preview is not a standard toolbar button. There are not233 independent exemptions or new waivers. No Floor finding was waived.

## What settled the findings

- **48,80 reported colour/font-literal findings:** move exact existing values into role-named root tokens. Surface, accent and shadow values stay the same; no theme replacement.
- **24a,18 reported groups with additional occurrences:** reuse existing spacing tokens wherever a literal had an exact matching value. No spacing sweep or scale change.
- **34/72:** closed navigation now has delayed visibility aligned to its160ms pointer exit and immediate keyboard exit. It remains inert. This also avoids treating intentionally translated closed navigation as visible page overflow.
- **49a:** shorten the sidebar connection label and prevent tiny Review Studio actions wrapping; the320px action toolbar becomes one column. The paid fix label remains explicit about API credits while fitting one line.
- **54:** remove repeated provider/agent ordinals and the redundant consent eyebrow. The agent section uses its plain action as the heading. Consent permissions, disclaimers and legal meaning are unchanged.
- **63:** model, quality and image count use a structured definition list rather than dot-joined metadata.
- **40:** the prompt gains a high-contrast bottom edge while keeping no inner box; the batch segment has a visible divider. All remain instantly focusable. A targeted checker pass is not an accessibility certification.
- **7b:** the opaque mask token aliases the existing opaque ground. Mask alpha remains the same; it is not a new black surface.
- **28b:** native video receives the actual responsive image currentSrc after that image loads. The already-present server-rendered image is still the initial fallback; no new media asset or paid generation is added.
- **39b:** the multi-line upload field is explicitly justified instead of being shrunk into a toolbar button.
- **29:** the user-requested transient modal backdrop isolates focus; it is not an ornamental glass content panel. Recorded as a dismissal with that concrete reason.

The source inventory still reports the same4 links and10 fields; handler count grows99→106. This is a static inventory, not a claim that every dynamic React state was formally compared. The original22 browser scenarios remain in the25-case suite, with selectors updated only for meaningful labelled UI changes; routes, IDs, inputs, backend calls, ownership checks and billing gates remain.

## Lightest useful depth

The review called for **polish** of tokens, labels, form edges and control behavior. The user separately selected the larger **Review Studio** composition through Impeccable Overdrive; no other proposed Overdrive direction was implemented. A full rebrand is not justified. Library virtualization, new backend capabilities, a different font/theme or cinematic page-load effects are not required to settle these findings.

## Limits and material

The report covers the browser studio and account/consent source plus the stated unauthenticated rendered routes, not a fresh external MCP-host design audit. Native Safari/iPhone, real assistive technology and native zoom remain unverified. No physical60/120fps guarantee, live-provider score quality, OAuth Allow or public-launch claim. Build and controlled performance evidence are in OVERDRIVE.md/PERFORMANCE.md; known hosted release gates remain in RELEASE.md.

There are no new visual-material slots or stock placeholders to replace. Actual user uploads/generations populate the canvas. The most useful next material is a real creator thumbnail and title from the authenticated application-provider smoke, within its already approved limit; that test still needs a usable owner session.
