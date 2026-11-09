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
