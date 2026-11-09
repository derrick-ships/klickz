> Continuation update: the exact protocol was recovered. Current work, remaining gates and verified changes are in [loop-v2-continuation.md](loop-v2-continuation.md). The record below preserves the earlier candidate assessment; its missing-protocol status is historical.

# OpenPikzels — LOOP round 1 candidate

Status: **incomplete release gate; not a completed LOOP round**. This candidate has not been promoted to main or deployed to production.

## Method and evidence

The exact LOOP v2 message, schemas, thresholds and prescribed seven roles were unavailable through the tools in this session. The parent supplied a summary and the exact evaluator prompt. Retrieval through personal context returned unavailable. The full protocol was requested; no reply was available when this record was prepared.

Four fresh reviewers completed the newcomer, competitor, power-user and designer lenses sequentially, without prior reviewers' findings. Their original JSON reports are preserved in evidence/loop-newcomer.json, loop-competitor.json, loop-power.json and loop-designer.json. A later model applied seven role perspectives to challenge the findings; this was one model using seven perspectives, not seven independent evaluators. See evidence/loop-adversarial-panel.json. Three divergent concepts and the rationale for retaining the requested review studio are in loop-concepts.md.

The source baseline is fd62c88f33f11de10daabdb081578833a52e654c. The route/state matrix is provisional and explicitly marks untested states. No exhaustive coverage or complete accessibility conformance is claimed.

## Implemented

- Owner-scoped draft checkpoints, first-draft autosave, source-aware saved edits, navigation flushing and recovery.
- New writing survives a generation finishing; the result is offered separately.
- Delayed title/comparison responses cannot populate a different account or a new session of the original account.
- Composer inputs lock only during chat transitions. They remain editable while generation runs.
- An older draft save cannot reselect an image after the user chooses another source.
- Sign-in and provider setup are actionable prerequisites. API activity is reachable within Connections and refresh does not retry paid work.
- ChatGPT access is described as models and usage; separate API access is required for studio image generation.
- A failed email code stays editable, with nearby field-associated feedback. Save draft has a visible button and readiness-specific instructions.
- Review layout protects image size at intermediate widths; settings reflow at 320px; persona/style removal has separate accessible controls and focus recovery.
- Generate and batch focus rings now use a light color. The bounded contrast calculation improved the minimum from about 2:1 to 4.508:1 on the inspected red/hover surfaces.
- Local image assets persist as bytes, avoiding the reproduced WebKit IndexedDB Blob-preparation failure. Existing Blob records remain readable; no stored library is reset.

## Verification boundaries

Tests use local production builds and explicit fixtures. No paid AI request, real provider sign-in or independent commercial evaluation was performed. Automated browser emulation is not physical-device testing.

The WebKit local storage failure was reproduced with an IndexedDB UnknownError: Error preparing Blob/File data to be stored in object store. Byte-backed upload, reload and real PNG export then passed. Legacy Blob creation itself is unsupported in that WebKit test runtime; legacy reads are separately exercised in Chromium. The version-1 WebKit fixture uses bytes and tests schema upgrade, comparison and feedback, not legacy Blob creation.

The local-only network barrier was corrected to allow non-network blob/data URLs. It continues to reject external network requests. This was necessary to distinguish actual image-storage failure from test-induced preview failure.

Final counts and performance measurements are recorded separately in evidence/loop-verification.json after the last run. Original reviewer findings are time-stamped observations of earlier candidate states; consult loop-issues.json for disposition.

## Gates that remain closed

1. **Independent evaluation — denied.** The browser approval gate declined chatgpt.com. No prompt was sent, and no rating or price exists. No alternate access was attempted.
2. **Production visual review — denied.** The browser approval gate declined openpikzels.com/studio. No alternate access was attempted.
3. **Actual screen reader — incomplete.** A bounded local VoiceOver attempt timed out before returning speech. It was restored to its prior off state. A successful automation harness exit is not a passed screen-reader check.
4. **Full contrast and state coverage — incomplete.** Axe found no confirmed violations in 17 inspected combinations, but gradient/overlap findings require further review. Bounded color calculations and visually checked focus rings do not cover every artwork pixel, native popup, error state or transition.
5. **Exact protocol — unavailable.** The supplied summary cannot establish verbatim LOOP v2 compliance. No threshold or missing role has been invented.

## Evaluator description mismatch

The prescribed evaluator description is hypothetical. It describes a density toggle, live-state command palette, custom fields, bulk selection, visible undo history, a universal 16px body floor and leave-form interstitials. Those features have not been established in this app; the source currently declares a 14px body base while the prompt input is 16px. Sending that description as an observed account of OpenPikzels would misrepresent the evidence. Any eventual evaluation must distinguish the hypothetical description from an evidence-based review of the actual product.

No >79/100 score or >US$10,000 estimate is asserted. The required hero remains unchanged; views are not guaranteed, and provider charges are disclosed.

## Remaining design work

Mobile editing density, intermediate-width image/analysis continuity and an authentic approved product walkthrough remain opportunities. No fabricated thumbnail result, uplift or customer outcome was added. Real provider completion, production OAuth pairing and all error/retry states remain outside this round's verified scope.
