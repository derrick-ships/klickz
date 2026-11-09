# OpenPikzels UX improvement cycle — 2026-11-09

The candidate improves draft continuity, setup clarity, request recovery and review layout. It preserves the red/dark brand, requested headline, provider integrations and existing finite motion. No paid model inference was used for this cycle.

> This records the earlier panel pass. The subsequent LOOP work, final verification and remaining release gates are in [loop-round-1.md](loop-round-1.md). It is not a production release notice.

## Review method and limits

- Four task-specific model reviewers examined newcomer accessibility, competitor positioning, power-user workflows and visual design. This was a critical expert-style panel, not recruited-user research or an independent commercial appraisal.
- Findings were challenged against source and fresh local production-build screenshots. The panel rejected a broad visual redesign and additional decoration because continuity and action clarity had stronger evidence.
- The cloud browser approval gate denied access to both openpikzels.com/studio and chatgpt.com. Neither denial was bypassed. No independent ChatGPT prompt was submitted, score obtained or design-price estimate received. The >79% and >US$10,000 targets are unverified.
- All new visual captures use the local build and explicit fixtures. The red tile image is a test asset; displayed score data is labelled a fixture. This does not validate provider output quality, CTR, conversion, subscription inference or real-user performance.
- Production release readiness and aliases can be checked through Vercel; browser verification of the live page remains blocked separately.

## Findings and changes

1. **Writing and recovery — improved and regression-tested.** First-session text previously had no conversation to autosave into. Drafts now receive owner-specific browser recovery checkpoints and one conversation is created for meaningful work. Checkpoints are validated, exclude unknown fields and report storage failures. A separate draft timestamp prevents a rename from making an older draft appear newer. Navigation flushes detached drafts before switching.
2. **Saved edits — improved and regression-tested.** An edit draft could lose its original-image preview and fail source validation. The editor, readiness and request payload now resolve the same saved source, including a draft's parent. The original remains immutable.
3. **Work during generation — improved and regression-tested.** Completion compares against the submitted snapshot. If the user writes a new idea while a generation runs, that draft and focus remain in place; a result-ready action offers the completed image.
4. **Setup — improved and fixture-tested.** The primary action opens sign-in or Connections when those are required. It never silently generates after setup. The connection page puts workspace sign-in and API setup before optional ChatGPT-plan information. Provider rows say “Key saved”; they do not imply live provider validation.
5. **Request recovery — improved and fixture-tested.** API activity is inside the modal where it is keyboard reachable. It includes refresh, timestamps, request IDs and links to saved image results. Refresh does not retry or dispatch inference. Uncertain outcomes retain their caution against duplicate requests.
6. **Keyboard and mobile — improved and tested.** Persona/style removal uses independent labelled buttons with focus recovery. Connections and Controls retain visible mobile labels. Settings reflow at 320px instead of truncating the format selector.
7. **Image review — improved and visually checked.** A container-based breakpoint stacks analysis until the workspace has enough room for a useful image and inspector. At 1100px the thumbnail leads and the main actions fit together. The 200px feed preview and full-image containment remain.
8. **Welcome copy — improved and visually checked.** A provider-cost qualification now sits beside “Start creating free.” The exact requested headline and existing outcome disclaimer remain.

## Verification

- TypeScript and production webpack build passed.
- 122 unit/database tests passed across 23 files.
- 40 unique Chromium functional checks passed across the affected workflow suites, including first-draft reload, immediate navigation, delayed save, account switching, concurrent writing, source selection, keyboard removal, API activity, setup, key-entry isolation, OAuth consent and Codex device-flow fixtures.
- Seven WebKit workspace checks passed, including delayed account operations, selected-source editing, recovery and concurrent typing.
- Two controlled performance scenarios passed; a separate final capture scenario produced desktop and mobile evidence.
- Initial failures exposed a narrow format selector and test-fixture readiness problems. The selector was corrected; fixtures now wait for account hydration and reset their own prior workspace before starting a new capture. The corrected checks passed.
- No physical iPhone testing, live AI inference or current live-page browser verification is claimed. The subsequent LOOP work reproduced and fixed WebKit local image storage; see the final report for byte-backed storage, legacy compatibility and current browser results.

## Performance evidence

Production build, Chromium, 390×844 viewport, CPU slowed 4×, 150ms latency, 1.6Mbps download, three runs:

- Median LCP: 1,320ms; budget 2,500ms.
- Median layout shift: 0.001; budget 0.1.
- Scripted INP sample: 40ms; budget 200ms.
- Maximum tested mode-switch feedback: 37.2ms; budget 100ms.
- JavaScript transferred: 182,671 bytes; budget 300,000.
- Total transferred: 212,891 bytes; budget 1,500,000.
- Third-party resources: zero.
- Review-preview feedback peaked at 25.4ms mobile and 25.3ms desktop under CPU4×; no long tasks were recorded during those sampled interactions.

These are local lab measurements, not field p75, physical-device FPS, an SLA or a Lighthouse score. Raw reports: [mobile lab](../evidence/performance-lab.json), [review interactions](../evidence/performance-review.json), [budget results](../evidence/panel-budget.json).

## Fresh visual evidence

- [Before: first-session studio](../evidence/panel-before-02-studio.png)
- [Before: intermediate desktop review](../evidence/panel-before-05-review.png)
- [After: studio](../evidence/panel-after-02-studio.png)
- [After: 1100px review](../evidence/panel-after-review-1100.png)
- [After: saved edit on mobile](../evidence/panel-after-edit-390.png)
- [After: mobile sign-in first](../evidence/panel-after-07-connect-mobile.png)
- [After: welcome with nearby cost qualification](../evidence/panel-after-01-welcome.png)

The visible focused “Skip to studio” link in an edit capture is a keyboard state. It is not a permanently displayed banner.

## Remaining work

- Obtain authorized live-browser access for post-deployment UI inspection.
- Obtain authorized access to an unpersonalized independent evaluator. Report its actual words, score, estimate and uncertainty; do not infer that a target is met from this panel.
- Validate provider-backed generation separately with approved accounts and spending. Existing integrations were preserved and exercised with fixtures here.
- Conduct actual user testing, especially with low-vision users, and physical-device testing before drawing broader usability conclusions.
