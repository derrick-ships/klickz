# OpenPikzels — LOOP v2 continuation

Status: failed/incomplete release gate. This is a tested draft candidate, not a passing round or a production release.

## Protocol and method

The original protocol is now available in loop-v2-original.txt. Its arrival resolves the earlier missing-protocol blocker; it does not authorize retrying denied browser access. Four fresh lens passes ran independently and sequentially: grandma, competitor, power user, designer. Their exact required JSON families are in evidence/loop-v2-*.json. A subsequent synthesis agent applied the seven prescribed critic roles; these are seven explicit perspectives, not seven independent people. The panel retained failed signoff.

The three divergent concepts and selection rationale are in loop-v2-diverge.md. The conservative option directly addresses two evidence-backed P1 findings with limited changes to existing flows. Structural onboarding and a clearly labelled no-spend rehearsal remain proposals, not shipped features.

## Changes and evidence

1. Draft continuity: selecting the active chat is a no-op, preserving the current editor and autosave. Search includes draft prompt, title and video brief. The active-chat overwrite was reproduced before the fix; see loop-v2-active-chat-failure.log and before/failure/result screenshots. Afterward all 13 workspace race tests and five workspace unit tests passed, including immediate selection and reload. Power-user re-review records the narrow closure in loop-v2-power-verify.json.
2. Provider setup: the secure key form explains what a key is, the selected provider's job, official setup steps, possible usage charges and encrypted server-side handling. It links back to free drafting. OpenPikzels password ownership is explicit. The masked field, blank-to-keep behavior and clearing on save/provider switch remain. Seven account fixture tests passed, including keyboard expansion of all four official guides. No real key or provider login was used. Grandma re-review records the explanation as addressed, with authentication-choice density remaining P2.
3. Essential text: save state and revision metadata increased from 10px to 14px, preview guidance from 11px to 14px, and the adjacent views qualification from 12px to 14px. This is a bounded readability improvement, not a claim of universal 16px typography or complete accessibility.

The first two source commits are 80e717f459670ef4fba4eb7556eae1f79e652c63 and 1b8390dc3cfa161ebaec9431ba1e51dc4f25fdf0. Connector text reads dropped only trailing newlines; bfaddbdb10e4d83511cbfebd960d4b697ff626c4 restores those bytes from a JSON export. Final source hashes are checked against the repository tree.

## Baseline expansion

Source inspection enumerated six page routes and 29 route handlers, without claiming all query or re-exported states are exhaustively modeled. Thirty ready-page combinations cover 320, 768, 1024, 1440 and 1920px. Local loading, failed-config/reload recovery and invalid/corrected-email checks were added. Internal page links are checked locally; external links are inventoried, not comprehensively fetched. See loop-v2-source-inventory.json, loop-v2-route-checks.json and loop-v2-form-checks.json.

## Gates still unavailable or incomplete

- Independent ChatGPT evaluation: browser access was denied. No prompt was submitted; no score or price exists. No alternate access was attempted.
- Production visual review: access to the live studio was denied. Local emulation and screenshots do not establish the deployed state.
- Actual screen-reader check: the earlier bounded VoiceOver attempt timed out before returning speech; VoiceOver was restored to its prior off state. It is not rerun or represented as passed.
- Full contrast and state coverage: axe has zero confirmed violations in the inspected combinations, but incomplete contrast checks remain. Untested roles, provider responses and recovery combinations fail the coverage gate.
- Independent evaluator prompt conflict: the later full prompt takes precedence over the short JSON format. Its hypothetical features must not be presented as verified live behavior. See loop-v2-evaluator-resolution.md.
- Real-provider output quality and complete production authentication remain outside these fixture-based UX tests.

The target score and price are not disclosed to an evaluator and are not asserted as achieved. There is no basis for advancing through nominal additional rounds while independent evaluation is blocked. Main and production are held under the user's all-gates release requirement, not a newly requested approval.

## Remaining design tradeoffs

Mobile editing still needs less vertical travel; intermediate review widths can separate image and analysis; the connection page still offers several authentication choices. A truthful worked product example, bulk actions and reference-aware local asset cleanup remain open P2 opportunities. The required hero is unchanged. No fixture is presented as a real AI result, no paid inference was requested, and no provider account or OS permission was changed in this continuation.

Final test counts, measured performance, source identity, image evidence and gate decisions are recorded in evidence/loop-v2-verification.json after verification completes.

## Final verification and commit references

- Production build/TypeScript passed; 123 unit/database tests passed.
- Broad Chromium run: 83 passed, three failed. All three failures were outdated surface/layout expectations, recorded in loop-v2-broad-first.log. Seven targeted motion/layout tests passed after correction, preserving motion checks and adding a minimum rendered image width. One additional stable key-entry capture test passed. This covers 86 distinct functional checks across runs; it is not presented as a single clean broad run.
- WebKit mobile/touch emulation: 38 passed, one legacy Blob-creation test skipped.
- Twenty-one axe combinations: zero confirmed violations, with unresolved contrast checks in all combinations.
- Two controlled performance tests and their budget check passed. Median mobile lab LCP 1,304ms; CLS 0.001005; initial script 183,040 bytes; no third-party requests in that scenario.
- All 12 Lighthouse runs passed unchanged budgets. Mobile performance scores were 98–99; desktop 100. These are lab scores, not an independent design appraisal.
- Source/layout commit: 7b92bca912c3212ef812e87b91a6a1bcb3473306. Test/coverage commit: db123ced6f477f03c706d054ee1a10ea3cf32886. Fourteen changed source/test files match the Git tree byte-for-byte.
- Main remained fd62c88f33f11de10daabdb081578833a52e654c when checked.

Stable 320px Chromium and 390px WebKit viewport captures show the key field, private-storage guidance and Connect key button without a blank gap. This resolves the bounded visibility concern; the earlier full-page capture inconsistency is retained in the reviewer record without inventing a cause.

Historical lens screenshots should be read at commit 0d6a518f82ced5ad09772f3bea8ac77808c66de7. Current route screenshots are verification captures and do not establish immutable before evidence for every state. The preserved active-chat failure screenshot/log records the original bug. No claim of complete LOOP evidence is made.
