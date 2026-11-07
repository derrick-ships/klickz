# Study adaptation — OpenPikzels

The full public/static REA study and original implementation appendix were read (76,945 characters). Source: https://app.notion.com/p/derrickserna/Pikzels-scoring-styles-and-one-click-fix-public-static-REA-study-4113935b82a681aeaf31ed4eadc18585?source=copy_link

The report does not reveal Pikzels’ proprietary algorithm. This implementation uses OpenPikzels’ own Jev rubrics, layout, prompts and provider contracts; no proprietary code, score weights or CTR predictions were copied.

## Implemented

- Five-pillar diagnostic with real 200px JPEG preview sent alongside the source. Idea/curiosity require the actual title and factual video brief. Missing scores stay null; zero stays zero. Any missing pillar makes the overall null rather than averaging only the known pillars. Confidence is an uncalibrated model signal.
- Optional vision critique is an explicit extra request, off by default. Without vision, numeric Jev scores do not invent visible evidence or unlock automatic image fixes. Supported evidence identifies the original or small preview; no fabricated bounding boxes. Possible promise contradictions block API fixes.
- A no-charge fix-plan compiler selects up to three supported issues, records exact wording/required objects/forbidden changes, binds source bytes, title, full signed diagnostic and model settings, and expires after an hour. Changes invalidate approval. The renderer receives only this reviewed plan and creates one new image without automatic re-analysis.
- Immutable ready-variant image/settings/prompt/lineage. Edits and resize create children; original images remain. Deleting a parent preserves its ID/digest in lineage. No lossless edit or automatic factual-preservation guarantee is claimed.
- Randomized human A/B comparison with matched 200px previews and optional full images; prior scores and edit rationale are hidden. The sealed comparison binds image bytes and shared factual context. Title/context changes invalidate votes. Tie/inconclusive keeps the original. Both variants remain saved.
- Persistent generation/analysis jobs reserve request ID + semantic payload before calls. Concurrent/changed/uncertain repeats cannot silently dispatch. Successful repeats return the saved result. Function-deadline reconciliation marks abandoned jobs/variants reconciling on status read; no automatic paid retry. UI and MCP expose job state.
- BYOK, bounded batches, one image per reviewed fix, explicit optional vision, provider timeouts and no automatic re-analysis limit accidental cost. HTTP/MCP share these backends.

## Adapted scope and remaining work

The existing Jev 0–3 rubric contract was retained rather than copying the appendix’s different scale. The ledger fits Supabase + Vercel serverless; it is not a background queue/outbox or provider-billing reconciliation service. There is no dollar-reservation ledger, automated AI comparison, automatic provider-result recovery or cancellation. Ambiguous results require checking the provider’s own history. Other provider-backed routes (title suggestions/profile preparation) retain their existing behavior and are outside this job ledger.

A held-out image benchmark, calibration and live Jev/OpenAI/Google application-provider validation remain outstanding. Tests use explicit fixtures; they verify behavior and isolation, not scoring quality. The separate Higgsfield brand assets are real completed jobs and have their own provenance/costs in ASSETS.md.

Hosted database migration: `openpikzels_diagnostics_jobs`, successful. Existing private-owner gates were preserved, including `studio_jobs_app_owner`; the attempted public-release source edit to remove this policy was rejected and did not execute. See RELEASE.md before any multiuser launch.
