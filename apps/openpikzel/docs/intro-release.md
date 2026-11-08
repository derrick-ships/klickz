# OpenPikzels introduction and state-flow release — 2026-11-08

The new first-visit introduction uses GET MILLIONS OF VIEWS and Without adding another subscription* exactly. Red/charcoal original aperture artwork anchors the page. Setup choices link to API connections, supported official local CLI plan use, and MCP. Cost/eligibility and actual storage behavior are disclosed; views and CTR are not guaranteed. The proposed closing is adapted to “Less guesswork” because creative scores cannot eliminate uncertainty.

Returning visitors go directly to /studio after a nonsecret entry preference is set. /welcome is always available. Existing mode links and repeated query values survive migration. Existing draft, profile, private image, account, OAuth and MCP storage identities are unchanged.

The state audit documents 36 source-inspected flows and their invariants in state-machines.md. It led to explicit durable Save checkpoints, preservation of edits made during a slow save, old-account error suppression and capability-response isolation. A shared conservative job policy gives people and agents the same next-action guidance, including unknown states. No paid retry or dispatch behavior is added.

Fresh Astra fast review found one Important checkpoint race and one Minor legacy-link coverage gap. Both were reproduced/addressed with regressions. Lighthouse identified insufficient contrast on a red CTA; its fill was darkened and rendered normal/hover contrast now exceeds 4.5:1. Final intro checks were rerun in both engines after this CSS-only adjustment. The explicit-save immediate-reload and delayed-edit regressions failed before the changes and passed afterward. The app-wide Chromium suite, focused WebKit transitions, unit/API/database tests and production-build performance gates are recorded in evidence/intro-release.json.

Visual review: actual rendered 320/390px mobile and 1440px desktop introduction screenshots inspected; no horizontal overflow; keyboard entry works immediately; reduced motion loads the static poster. WebKit is an engine test, not a physical iPhone claim. Original brand assets were reused; no stock, new paid stills or video were generated.

The preceding release already delivered blurred compact navigation over the mounted workspace, voice-input removal and the supplied OpenAI/Google logos rendered white without raster alteration. Production smoke verified blur(8px), four decoded picker logos and zero voice buttons. The companion archive remains byte-identical.

Free-tier and safety: no database migrations, account settings, secret writes, paid provider requests, plan changes or additional access grants were needed. Existing AI/key/OAuth integrations remain as previously configured; this UI release does not claim a fresh real-provider validation of every account.

Reproducible checks: npm run typecheck; npm test; npm run build -- --webpack on the isolated Mac snapshot; portable browser source config; local Chromium/WebKit executable configs excluded from publication; two browser performance tests; budget checker; three Lighthouse runs for each of / and /studio in mobile and desktop profiles. Lighthouse is controlled lab evidence, not field p75 or proof of production CTR.

Remaining boundaries: see the audit for deferred DB job-edge enforcement, cross-tab conflict resolution, provider-specific live consent/plan behavior, orphan cleanup and companion packaging/timeouts. No exhaustive-interleaving or zero-breakage claim is made.
