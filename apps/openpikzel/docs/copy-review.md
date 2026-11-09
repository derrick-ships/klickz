# Studio copy review — 9 November 2026

Baseline: `48898b04761328b61c43d9bc3191960c14a20b0b`.
Evidence: Aside's read-only inspection, https://derrickos.slack.com/archives/D0CFG0U5XE3/p1794228071230969?thread_ts=1794227403.033789&cid=D0CFG0U5XE3. Competitor observations do not independently validate paid behavior, exported files or product claims.

## Changes

- Analyze explains that both video title and summary are needed for a full score; Idea, Curiosity and overall remain blank without both. Visual-only review stays available.
- A persistent “Describe your thumbnail” label and prompt guidance ask for the focus, scene, mood and quoted image wording, without guaranteeing exact generated lettering.
- Ready actions identify their task: Create thumbnail, Create variation and Apply AI edit. Sign-in, connection, unavailable, busy, analysis and title-generation branches remain intact.
- The empty result inspector says “Review thumbnail and title” and “Set up analysis,” describing navigation to inputs rather than an immediate paid analysis.
- “Generation settings” and “Planning effort” replace vague labels. Quality, complexity, model, format and batch values and backend mappings are unchanged. Provider-cost uncertainty and the measured-CTR disclaimer remain.
- The welcome page and Derrick's chosen headline remain unchanged.

## Title investigation and bounded fix

The creation title is a display name: saving a draft falls back to the first 80 prompt characters. The old review opener and generation completion promoted that display name into the editable video title. Those overwrites are removed. Choosing a creation preserves the current same-chat title or restores the destination chat's explicit draft title / saved analysis-context title. A standalone asset name is not assumed to be a video title.

No creation names or historical records are changed or deleted. Previously saved draft titles remain editable; ambiguous legacy values are not guessed at or silently migrated. No schema or provider changes are included.

## Verification

Results are appended after execution. Browser scenarios use local or intercepted fixtures, not paid provider calls. Prior incomplete LOOP gates are not certified by this focused copy release.

## Complete handoff disposition

The full handoff contains 17 copy-only groups (OP-01–17) and six behavior-dependent groups (OP-18–23).

- OP-01 rejected: preserve the user-approved hero, hook and subtitle, plus existing cost and outcome disclosures. No competitor slogans or pricing are copied.
- OP-02–08 adopted: descriptive composer labels, per-mode guidance and actions, explicit scoring prerequisites, result-review setup, and settings terminology.
- OP-09–14 adopted: “Before you run,” meaningful minimum-input guidance, “Images per request,” useful library orientation, “Download image,” and explicit provider billing with unknown cost. No export format/size/resolution promise is added.
- OP-15 adopted only for signed-in users; signed-out users retain sign-in guidance.
- OP-16 adopted: progress describes the submitted request, not a repaired/completed image. Elapsed time remains elapsed time.
- OP-17 adopted: “Review suggested fixes” opens the existing review. Its inline button also respects fixBlocked, matching the existing analysis overlay. Paid confirmation stays separate.
- OP-18 implemented with a real handler: a filtered-empty library clears search and favorites; a genuinely empty library still offers creation.
- OP-19 implemented from authentication and save state: signed-in storage copy reflects workspace saving or the actual local/sync-failure status, independently of AI readiness.
- OP-20 implemented by creation status: ready-but-unavailable previews have a read-only refresh; generating, failed and uncertain outcomes retain distinct wording. Refresh never creates a new generation.
- OP-21 implemented with explicit loading/succeeded/failed lookup states, read-only retry, and stale-response guards. Unknown status is not rendered as confirmed disconnection or an empty agent list. No key values are exposed.
- OP-22 implemented in studio readiness and submit validation before constructing the title-image request. Blank raw title and direction cannot trigger dispatch from this UI. The API contract is unchanged; this is not a new claim about every external caller.
- OP-23 implemented by separating existing display names from explicit video-title context, preserving user-entered titles, and explaining the distinction beside the input. Existing ambiguous legacy drafts are not automatically migrated.

### Executed results

- TypeScript, the production build and all 124 unit/database tests pass.
- Chromium: 92 unique scenarios covered. The full pass had 89 passing and three failures; all three then passed in a 21-test targeted run. Two failures were stale/ambiguous test assertions corrected for the deliberate blocked-fix behavior and Next's extra alert. The unchanged compact-navigation focus test passed on rerun; its intermittent failure remains a test-stability limitation, not a claimed fix.
- WebKit: all 20 focused copy/state/concurrency scenarios pass.
- Two controlled performance tests and the existing budget checker pass.
- Existing axe matrix: 21 route/state/breakpoint combinations, no confirmed violations, one incomplete contrast assessment per combination. This does not certify full contrast or screen-reader coverage.
- Visually inspected rendered desktop (1440px) and mobile (320px/390px) screenshots of prompt/settings and analysis. Reduced-motion emulation and overflow assertions are included. These are browser-emulated widths, not physical-device testing.
- The initial copied-dependency build failed; a fresh lockfile-based offline install resolved it. Final validation uses that clean install.
- No paid generation, provider-key write, new production login, independent design evaluation or previously denied browser access was attempted.

Local evidence is retained in the copy-review workspace: `copy-*.log`, `copy-final-status.json`, and `evidence/copy-analysis-*.png` / `evidence/copy-settings-*.png`.
