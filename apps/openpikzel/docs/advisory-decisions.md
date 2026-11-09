# Advisory reconciliation and implementation decisions

The complete 396-line user attachment Pasted text(20261109-170551).txt was read. Its observations concern 665b96b. The comparison baseline for this work is deployed/main 7af2f410a16dc0c841d2aabe23ef0648331c4a10, whose 258 exported source files were preserved before editing in the sibling advisory-before-7af2f41 directory.

## Findings already superseded at 7af2f41

Hosted API chat, reversible enhancement, separate conversation/image choice, automatic image-first analysis, contributor/model provenance, metadata-only video context, generative recomposition and Browse/Suggested/grayscale previews exist. The mandatory written-summary gate was removed. These facts do not establish real provider entitlement or full video-content analysis.

## Batch 1: onboarding and request clarity

Requirements before prompt entry; one shared email-link/code/password component; explicit blank-email code-entry feedback; empty/short draft validation before creating a conversation; deep-link mode applied after recovery without changing its prompt; one reference row per mode with readable Link/Library controls; public style chips; neutral startup action; visible model names with backend IDs in details; consistent five pillars; more legible helpers and sidebar actions; lighter blurred backdrop; reachable generation action. Signed-out connection hash targets explain sign-in prerequisites instead of silently landing at unrelated content.

Image-output estimates use documented standard list prices and the OpenAI official output-token calculator for the actual 1536x864/864x1536 API sizes, with the selected quality and batch. Google uses native 1K output list prices. Input, thinking/text, review, account-specific rates/taxes and final total remain unknown or additional. No provider calls or billing changes are used to obtain these estimates.

Automatic review now requires an explicit opt-in on this device, scoped to the current account. A legacy draft containing a default-true checkbox is not treated as new consent. Opting out prevents additional review dispatch; originals and successful images remain available.

## Further authorized implementation work

Explicit capability/provider selection for titles, visual critique and profile preparation; no connection-based provider fallback. Bounded context and typed proposals remain application-validated. Durable job viewing/recovery should read persisted job outcomes after reload, with no automatic replay of a billable request. Analysis history should preserve exact source/context/instruction/rubric/model provenance and never change the user's title. Changes to live schema/access rules require reviewing the exact migration and current schema rather than assuming the advisory's proposed tables already exist.

## Read-only hosted ChatGPT investigation

Current source uses Codex's public OAuth client ID in codex-provider.ts. The hosted codex-connection path seals access/refresh credentials server-side, and reads model/usage endpoints; it does not implement studio image or conversation inference. No stored token values, auth files or credentials were inspected.

Current official OpenAI docs distinguish local/open-source registration from website identity and remotely hosted usage. The OSS path describes dynamic registration with an issued app/account/workspace client ID. The remotely hosted interest process does not itself establish approval for this integration. The website guide describes a registered client and callback. Whether the current Codex-client usage/model-only implementation is permitted is still unverified. No claim of a terms violation or vendor approval is made. Existing connections and flags stay unchanged.

Sources checked 2026-11-09:
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/website
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Model and pricing verification

OpenAI catalog confirms gpt-image-2.6-flare and gpt-image-2.6-sunburst, image generation/editing, and the image guide confirms low/medium/high complexity plus low/medium/high/xhigh/max quality. Flare is described for fast iteration, Sunburst for detailed visual work. Both list $30 per million image-output tokens. The calculator's different output-token counts are used rather than applying older models' per-image prices.

The fetched official Google pricing document identifies gemini-3.1-flash-image and gemini-3-pro-image. It lists standard 1K image output around $0.067 and $0.134 respectively, excluding additional inputs/text/thinking. Catalog/pricing existence is not proof that a user's key can access a model.

Sources:
- https://developers.openai.com/api/docs/models/gpt-image-2.6-flare
- https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst
- https://developers.openai.com/api/docs/guides/image-generation#calculating-costs
- https://developers.openai.com/api/docs/pricing#image-generation
- https://ai.google.dev/gemini-api/docs/pricing

## Decisions requiring Derrick

- Trial funding: specify an amount/cap, provider/project and intended audience before any credits or billing change. No free-trial grant is implemented or purchased.
- Google OAuth: choose/approve the Google Cloud project and OAuth application, registered Supabase callback and OpenPikzels origins before activation or persistent secret creation/storage. UI unification does not require enabling this provider.
- Hosted ChatGPT: obtain written vendor confirmation for the exact hosted public-client model/usage flow or choose a reviewed replacement/gating plan. No tokens are deleted, connections disabled or authorization scopes expanded by this work.
- New credential types (for example Anthropic) and any real paid provider tests need explicit scope/amount approval.

The main headline GET MILLIONS OF VIEWS and Without adding another subscription* remain intact. No purported real before/after samples are fabricated to replace the decorative banner.

Derrick selected “Prepare setup and keep email sign-in for now” for Google OAuth. Prepared callback: https://iufiqfvufoecbuakzale.supabase.co/auth/v1/callback. No Google project/client was selected and no provider was enabled. A later approved setup must register the OpenPikzels origins/callback in Derrick’s chosen Google Cloud project and store the client secret directly in Supabase, preserving unrelated redirects.

## Batch 1 validation

Typecheck, full unit suite (155 tests in 28 files), production build, 75 Chromium browser checks, 74 mobile WebKit checks and two controlled performance checks passed. The mobile lab budget passed after reserving creative-chat loading space: median LCP 1472 ms, CLS 0.0010 and sampled INP 32 ms under the recorded 4x CPU/network profile. These are local lab measurements, not production field percentiles.

The successful code-sign-in test continues from the studio to /connect#api and confirms the original local direction remains in its account-scoped draft checkpoint. All authentication and provider responses in browser tests are fixtures; no sign-in emails, paid model requests, billing changes or credential writes were used. The current 320/768/1024/1440 layout checks verify expanded-action reachability, horizontal fit and 44px style targets.

Google activation remains deferred to Derrick's later request; see google-sign-in-preparation.md. This batch does not yet replace the existing connection-based text-provider fallback or add a detached job worker/full video analysis.

## Batch 2: explicit provider roles and title preservation

Titles, prompt enhancement, optional visual critique and persona/style preparation now require an explicit OpenAI or Google API choice. Shared route guards no longer substitute Google for unavailable OpenAI. Existing requests without a new role field default to OpenAI and are blocked if it is unavailable. Image and conversation selection remain independent. UI choices are persisted in the owner-scoped draft; optional visual critique is a separate checkbox that describes its extra call. MCP inputs expose the same provider selections. No provider connection or token is changed.

Analysis updates the current score without overwriting the creation title. Its assessed title remains in the signed score and persisted job outcome. Tests confirm a saved analysis replays after creation-title changes with one scoring dispatch, and an unavailable selected reviewer blocks before reservation/scoring.

Validation: typecheck, 162 unit tests in 30 files, production build, 76 Chromium and 75 mobile WebKit checks, two controlled performance checks and the existing budget passed. Median lab LCP 1444 ms, CLS 0.0010 and sampled INP 32 ms. Provider and account responses remain fixtures.

Read-only hosted schema verification confirms studio_jobs and studio_creations, no studio_analyses table, a user/created_at index on jobs, and an existing studio_reconcile_jobs function that only marks the authenticated user's expired jobs/variants uncertain. No schema, policy, security setting, credential or billing change was made. A saved job record is not a detached worker; browser-driven automatic review can stop when the page closes.

## Recovery and saved analysis history checkpoint

The studio now reads recent persisted requests on sign-in/reload, refreshes active statuses every five seconds for at most ten minutes, and refreshes the library after observing completion. Stop waiting aborts/pauses the viewer's reads; it does not cancel provider work or promise a refund. The viewer never replays a paid POST. Reads and results are fenced to the current account/session; concurrent unrelated workspace actions remain guarded and now explain a busy refusal.

Analysis history is served from existing succeeded analyze-job results with owned-source checks, a validated timestamp/id cursor, signed-score verification and an exact current-image digest comparison. Older, changed, malformed or different-image records are identified explicitly. History never changes the current title/score or offers a paid fix. Browser and MCP list_analyses use the same owner-scoped reader. No new database table, migration, RLS policy or security setting is needed.

Typecheck, 168 unit tests in 31 files and production build pass. Five focused recovery/history/provider-choice browser checks pass in Chromium and mobile WebKit; history screenshots cover 320/768/1440. A broader regression/performance run remains due after the next context/output changes. The saved source is a checkpoint, not a deployed release.

## Final tested follow-up: context, native output and truthful availability

Conversation context now includes only the current owner's selected persona/style briefs (name 80, notes 800, prepared brief 2400 characters), up to six selected reference paths, and a separately labeled unexamined YouTube link. Photo references are not attached without the explicit chat checkbox; at most the first two are attached in addition to the selected source image, with the remaining images declared unviewed. Recent conversation remains capped at 12 messages / 4000 characters each. Foreign profile/reference access fails before reservation or inference. Project titles and source context are bounded. Proposals are tied to their source and context; a late proposal cannot replace a newer direction. Enhancement remains review/apply/undo and image actions still require a separate user click.

Google system instructions now occupy the provider's systemInstruction field, separately from project data. This field and responseFormat were verified against the official public v1 discovery schema, without a provider inference call. The centralized instruction version is openpikzels-harness-1.1. get_workspace exposes model/role capabilities, saved-connection flags, reference limits, no-fallback behavior and explicit unsupported capabilities, without equating a saved key with entitlement or available credit.

Generation now retains the full provider-returned pixel dimensions instead of cropping to 1280x720 / 720x1280. The UI reads saved image dimensions and flags a returned aspect ratio that differs from the request; it does not crop or automatically retry. Nominal native ratios permit a 3% pixel-grid rounding tolerance (Google documents 768x1376 / 1376x768 at 1K). Original source paths remain untouched. Generation/edit/recomposition/upload/layout provenance is recorded on new creations; ready-variant immutability was inspected read-only and remains unchanged. Recomposition keeps the source's chosen title. Duplicate source/reference paths are sent once. Google receives every selected supported reference instead of silently truncating after ten; documented request caps are checked before dispatch (14 Google, 16 GPT image input slots).

Private provider lookup remains neutral until the current account's read completes. Account changes clear old connection flags; failed reads are labeled unknown and direct the user to refresh Connections. Sign-in remains the shared email flow. Native selects, reference naming and the extra-reference consent row are keyboard/mobile accessible.

Final validation: 183 unit tests in 33 files, typecheck, production build, 82 Chromium and 81 mobile WebKit checks, two controlled performance checks and the strict existing budget passed. The local throttled mobile lab median was LCP 1388 ms, CLS 0.0010, sampled INP 40 ms; maximum immediate-feedback sample 27.9 ms, 196272 script bytes, zero third-party requests. These are local lab samples, not field p75, an SLA or live provider tests. Screenshots inspected include 320px onboarding/expanded action, analysis history and unexpected-native-ratio preservation; automated layouts also cover 768/1024/1440 and 1280x800 action reachability.

All authentication/model responses in functional tests are fixtures. No paid provider test, real sign-in email, purchase, trial-credit grant, Google credential, provider activation, account/security-setting change, token read or connection removal was performed. The chosen landing-page headline and original snapshots remain intact.

## Remaining limits and release state

Full video watching/transcription is not implemented: analysis can use YouTube title/description metadata and chat labels a supplied link unexamined. Consumer subscription chat and Higgsfield image execution remain unsupported. Saved job/status recovery is implemented; a detached worker and automatic continuation of browser-orchestrated review after page closure are not. Workspace mutations are still serialized with an explicit busy explanation; this is not a complete per-entity reducer rewrite. Title/profile text endpoints are explicit user actions and are not claimed to have the same durable recovery coverage as generate/analyze/creative jobs. No live signed-in provider entitlement or billing outcome is established by these fixtures.

The onboarding-only commit is 5d74f5759f52384d26178eb77514294bfe2d1716 (tree 4e226371d2e460dc15b060eac3204582ca51a997). Its source is separately preserved in advisory-batch1-reviewed. Main was updated only after Derrick explicitly approved that commit/deployment. Production was last verified at 7af2f410a16dc0c841d2aabe23ef0648331c4a10. The onboarding deployment has not been attempted because automatic approval review separately rejected uploading tests/release-export.test.ts; its sole added test checks inclusion of these advisory/setup docs. Exact content was verified against the approved commit, and a file-specific approval request is pending. Newer follow-up changes in this report remain uncommitted/undeployed pending their own release approval.

Additional primary sources checked 2026-11-09:
- https://generativelanguage.googleapis.com/$discovery/rest?version=v1
- https://aistudio.google.com/docs/image-generation
- Installed official OpenAI Node SDK image-edit parameter documentation (up to 16 GPT input images). Catalog/parameter documentation does not verify account access.
