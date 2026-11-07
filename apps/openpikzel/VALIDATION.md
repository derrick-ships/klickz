# OpenPikzels validation

November 7, 2026. Final validation covers TypeScript, 69 unit/database/route/protocol tests, a production build and twenty-five functional Playwright browser tests plus the root lab and two-viewport review interaction scenario. Tests make no paid provider requests.

## Verified locally

- Five studio modes, model/quality/intelligence/format/batch settings, real reference uploads and profile persistence, local drafts and downloads, actual 720×1280 PNG output for instant resize, responsive editor and 44px mobile controls.
- OpenAI generation/edit contract, real image/title Jev payload with five rubrics, optional vision observations, Jev-only analysis without an extra provider charge, Google image contract and user-key forwarding, identity briefs, atomic batches, duplicate prevention and partial failures.
- All five source migrations replay in PGlite: per-user row/folder isolation, foreign-key ownership, private buckets, provider ciphertext ownership, and public-release row isolation. The final release migration is intentionally unapplied in hosted Supabase.
- OAuth discovery, DCR redirect restrictions, mandatory S256 PKCE, exact resource audience, code theft prevention, single-use codes, expiration, scopes, refresh rotation/replay and revocation. Consent Origin/cookie protection and state-preserving Deny. Purpose-bound authenticated encryption and concurrent per-request BYOK contexts. Global owner keys never fall back to other users.
- Actual SDK Streamable HTTP initialization, tool discovery, tool invocation, read-only protection and bundled MCP Apps HTML resources. Direct HTTP generation/analyze/prepare/resize routes independently reject AI grants missing write permission.
- Browser HTTP registration→branded consent→Deny flow. Signed-in onboarding fixture verifies provider key entry clears immediately and never enters localStorage; connected-agent revocation controls and mobile layout render. A real iframe host bridge fixture exercises the bundled Apps UI, creation selection, score display, copyable fix prompt and clearing hidden thumbnail selection before resize.

Signed-in onboarding and widget screenshot data are **explicit test fixtures**, not real accounts, real provider scores or live generations. Screenshots include `evidence/openpikzels-provider-onboarding.png`, `openpikzels-provider-onboarding-mobile.png`, `openpikzels-oauth-consent.png`, `openpikzels-mcp-widget.png`, `openpikzels-mcp-widget-mobile.png` and the existing editor captures.

Impeccable, Emil and Hallmark were installed and applied. The original editor's Hallmark rendered audit had zero FAIL/open REFLEX/WARN, with compact spacing waived to follow the user's pinned layout. Independent review of new OAuth/account code found missing direct-route write checks and global sign-out behavior; both were corrected and regression-tested. New widget hidden selection was cleared, and account/consent step labels changed to sentence case without tracking. Real browser captures verify the added screens.

## Verified in hosted services

- Private GitHub PR #2 preserves the existing root thumbnail project.
- Vercel Authentication remains enabled for non-custom deployments; custom domains are public. OpenAI/Jev variables are encrypted and preview-only; production AI remains disabled. No bypass secret is created.
- Supabase hosted private-studio, private-accounts and diagnostics/jobs migrations succeeded. New provider/OAuth tables have RLS, deny anon SELECT and each retain a restrictive owner-preview policy. A rolled-back synthetic key/grant transaction confirmed another authenticated identity cannot see the rows. No test grants or keys persist.
- The main thread independently verified `openpikzels.com`/www attached to this Vercel project, working HTTPS and www→apex redirect. Domain routing is complete. This worker’s earlier GoDaddy cloud-browser restriction is no longer a domain blocker.

## Not yet verified live

No real OpenAI/Jev/Google response, paid smoke test, real-client OAuth Allow/refresh sequence, production feature promotion or external Claude/Cursor/Codex connection is claimed. The paid smoke test is authorized but awaits a usable authenticated owner session. Multiuser release and authenticated validation remain pending; see RELEASE.md.

Automatic review rejected a batch that would also have copied owner provider keys to production. A read-only check confirmed no write occurred. The narrower approved preview-only operation succeeded. No owner keys are required in production for the BYOK design.

## Brand-production extension

Two original GPT Image 2.6 backgrounds and two silent Kling 3.0 clips were produced through Higgsfield for 13.5 credits, then visually inspected and compressed. These completed branding jobs do not verify the app's separate OpenAI/Jev backend credentials. Brand tests pass for actual finite WebM playback without controls/looping, pause on editing/preference change, and no video source or request for reduced-motion/data-saving visitors. All six web assets total about 173 KB; posters load without external media hosts. ASSETS.md records exact provenance and limits.

## Study-adaptation verification

Real 200px image resizing, zero vs missing scores, null overall for partial diagnostics, context hashing, contradiction gates, signed diagnostic integrity, selected issue/evidence validation, preservation constraints, settings/source/expiry binding and stale re-analysis invalidation are unit-tested. Persistent job tests cover concurrent reservation, changed-payload rejection, successful replay, uncertain outcomes and SQL deadline reconciliation without paid retries.

Database replay verifies immutable ready variants and durable lineage after parent deletion, immutable job identity/caps, owner isolation and reconciliation permissions. Comparison route tests verify randomized real 200px previews without prior score metadata, tie behavior and rejection of cross-account, expired, stale-image, changed-title or changed-factual-context votes. A fresh fixed variant retains its approved brief/audience.

The partial-diagnostic browser fixture shows missing context and an explicitly blocked no-charge plan, with no `/api/generate` dispatch. Fixture screenshots: `evidence/openpikzels-fix-plan-blocked.png` and `evidence/openpikzels-partial-diagnostic-mobile.png`. Independent review’s final comparison-lineage context defect was corrected with regression coverage. No scoring calibration, measured CTR gain, automated pixel-fidelity verification or live application-provider response is claimed.

## Premium UI follow-up

All four supplied images were retrieved from Library and visually inspected. Their treatments informed the existing red/dark system. Play/Pause was removed. New browser coverage checks roving Arrow/Home/End tab navigation and focus, native dialogs with Escape, no script errors, long prompt content and overflow at 320/390/768/1440px. Controls remain usable with reduced motion. Impeccable’s one requested mechanical pass returned no findings. Rendered desktop/mobile captures were inspected and refined. The final red/white control contrast exceeds 4.5:1; this is a targeted check, not a full accessibility certification.

No backend or hosted policy changes, new API calls or new generation credits were required by this UI pass. App-provider/OAuth live-validation gates from RELEASE.md remain.

## Mobile image regression and performance gates

The user’s IMG_9018.png was retrieved and inspected. A pixel-based browser regression reproduced the shallow 430px crop (10px below the red plane). The new 3:1 layout yields 38px below it; still and moving captures at 320/375/390/414/430px were actually opened for visual review, along with desktop1280/1440 and the reduced-motion/settled frame. Independent review: ship.

`npm run verify:release` passed: 69 unit/database/route/protocol tests, TypeScript/build, 16 functional browser tests, an isolated three-sample mobile lab and six Lighthouse runs with unchanged limits. Lighthouse median-run mobile: performance98, accessibility100, best-practices100, SEO100; LCP2386ms, TBT66ms, CLS0.001. Desktop: all four categories100, LCP522ms, TBT0, CLS0.

The separate CDP-throttled lab (390×844, CPU4×, 150ms latency, 1.6Mbps down) measured median scripted INP64ms and maximum click-to-two-frame feedback47.9ms; its initial encoded-body total was255393bytes. Lighthouse includes transfer overhead and reported261081bytes mobile. No missing/invalid metrics are treated as passing. These are controlled local samples, not field p75 or authenticated hosted-provider timings. Native WebKit could not launch because this environment lacks required system libraries; no Safari/iPhone-device verification is claimed.

## Impeccable Layout follow-up

Final TypeScript/build,69 unit/database/route/protocol cases and19 functional browser cases pass. New coverage checks compact navigation at390/768/1024, inert background/closed navigation, Tab wrapping, Escape/Close focus restoration and content-action focus transfers. Actual DOM groups remain aligned across320/375/390/430/768/1024/1440. A persona created through the real local upload flow with an80-character Spanish name wraps fully in its dialog and truncates inside its bounded selection chip. The key-entry form is first in DOM/mobile order; provider status remains visible and disconnectable. Shared dialogs now have an accessible heading name, and favorite buttons expose pressed state.

Actual rendered captures were opened for desktop, tablet, phones, empty dialogs, provider fixtures and the maximum-length name. Existing art-margin tests preserve the3:1 mobile crop. Final Impeccable layout detector returned `[]`. See LAYOUT.md for all seven structural verification questions and remaining limits; this does not claim full accessibility conformance or native Safari validation.

The final layout release also passed the isolated mobile lab and all six Lighthouse runs with unchanged budgets. Fresh numbers are in PERFORMANCE.md and the two JSON reports; earlier mobile-correction figures above are historical.

## Delight motion verification

The existing TypeScript,69-case unit/database/protocol suite and production build remain the base. Three additional browser scenarios raise functional coverage to22: actual IndexedDB draft confirmation, failure without false success, repeat saves, clearing on subsequent edits, no replay after reload, pointer-only drawer/control continuity, global keyboard shortcut behavior and320px reduced motion. Keyboard state/focus changes stay immediate. Four-pixel acknowledgment is bounded to260ms; reduced motion uses100ms opacity without transform. No new dependency, paid generation, sound or looping effect is introduced.

Actual390/1440 mid/settled save captures,320px reduced-motion capture and the compact drawer were opened for review. The one requested Impeccable mechanical scan found no issues in the changed motion targets; the later input-binding/global-shortcut adjustments do not alter visual recipes. The final build's controlled performance numbers are in PERFORMANCE.md and JSON reports. Native Safari/iPhone and live-provider/OAuth limitations still apply. See DELIGHT.md for exact values, deliberate exclusions and implementation safeguards.

The finished delight implementation passed the full release gate, including22 functional browser cases with emulated touch PointerEvents and the global Ctrl+B shortcut starting from body focus. All6 fresh Lighthouse runs and the isolated3-sample lab passed unchanged budgets; fresh values are in PERFORMANCE.md and JSON reports.

## Clarify copy follow-up

TypeScript,69 unit/database/route/protocol tests, production build,22 functional browser cases, isolated3-sample lab and6 Lighthouse runs passed with unchanged budgets. Updated existing scenarios exercise singular references, provider onboarding and explicit no-charge preview versus paid fix action. Both blocked and ready fix plans are fixtures; no /api/generate request is sent by previewing. Actual320/390/768/1440 copy captures were opened, including the internally scrolled ready-fix dialog. API-disabled versus missing-key recovery messages now match the same existing feature gates. No provider, permission or billing behavior changed. See CLARIFY.md and fresh performance reports. The two UI Motion findings were subsequently resolved and regression-tested in Review Studio below.


## Review Studio and Hallmark — current release

The user-selected image-first review workspace retains original edit/analyze/fix/resize/download handlers and adds genuine200px preview, adjacent desktop evidence, mobile stacking and explicit creation-control disclosure. Drafts retain their editor workflow. Dialog Escape now closes the topmost dialog before a compact drawer; native close restores a usable trigger/fallback. Keyboard pressing keeps button geometry/focus outlines stationary.

Final npm run verify:release passed TypeScript/build,69 unit/database/route/protocol cases,25 browser cases,3 root-lab samples, the two-viewport review performance gate and6 Lighthouse runs. Snapshot-only additions then passed the3 Review Studio cases again. Impeccable mechanical scan returned []. Hallmark rendered empty-generation/analysis and connection scope reports0 Floor failures,0 open Reflex,0 Warn after remediation;233 raw waivers comprise232 existing compact-spacing occurrences and one justified112px image input. No Floor failure was waived. See HALLMARK.md for full scope and exact rationales; this is not accessibility certification.

Actual desktop/phone/tablet captures, partial/unscored/error/analysis-control states and200px preview were inspected. Independent fresh-context finish review: ship, no concrete defect in supplied renders. All diagnostic scores and account/paid-plan screenshot values remain explicit fixtures. Mobile Lighthouse97,desktop100; current detailed measurements are in PERFORMANCE.md. No live provider call, production promotion, hosted access change or new credit use. Previously documented provider/OAuth/public-release and Safari limitations remain.
