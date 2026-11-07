# OpenPikzels — Clarify copy

## Audience and voice

Creators packaging YouTube videos, including people new to API billing. Keep the English interface, OpenPikzels identity, red/dark design, model names, five pillars and named workflows. Use direct actions, concrete outcomes and calm recovery. Do not imply that saved credentials were verified, a saved draft is an image, a reference profile is a trained model, or a fix guarantees performance.

## Message hierarchy

State the current fact, the next useful action, then the context that changes a decision. Credit use belongs before the action. Distinguish missing connections, disabled AI features and signed-out states. Do not promise that adding context forces every pillar to receive a score.

| Flow | Before | Clarified result |
| --- | --- | --- |
| Connections | Make it yours; provider use assumed | Connect your AI; OpenAI/Google generate, Jev scores; provider credits pay for requests. |
| Saved key | Connected | API key saved securely; no test request was made. A saved key is not presented as a successful provider test. |
| Unconnected provider | Use your own API key | Not connected. |
| Draft | Save drafts while AI connects | Save a draft now; connect a key to generate. Saved instructions are distinguished from a rendered image. |
| Analyze | Factual promise / visual rubrics | What viewers see or learn; Idea and Curiosity require both title and video summary; missing context leaves those pillars and overall blank. |
| Optional vision | Image-specific vision critique | Detailed image review, explicitly one extra OpenAI/Google request. |
| Fix | Original lineage / verified pixel mask | Preview before spending credits; original stays saved, whole-image edits may change other details; review before download. |
| Fix action | Apply one fix with my API | Generate fixed image · uses API credits. Preview fixes remains no API charge; no automatic re-score. |
| Resize | Softly extended background | Keeps the whole image, fills extra space with a soft background, uses no AI credits. Confirmed in both local Canvas and server Sharp implementations. |
| Profile | Reference-guided consistency, no fine-tuned model claimed | Photos guide images; Prepare profile uses AI credits to describe references and does not train a custom model. |
| Confidence | Uncalibrated | Not a measured probability. Numeric semantics and thresholds unchanged. |
| Requests | Persistent jobs / reconciling | API activity / Checking outcome — wait before retrying. Request caps are displayed with normal singular/plural. |

Removed the redundant Connections eyebrow. Kept the visual layout, mode labels, billing behavior, encryption guarantees, OAuth permissions and copyable MCP tool instructions. The owner-only notice no longer implies that domain setup is still pending. Sign-up states the8-character minimum before submission and names its busy operation. Error recovery favors keeping unsaved work open or checking My creations before retrying uncertain requests.

## Short terminology glossary

- **Draft:** saved thumbnail instructions; no generated image yet.
- **Creation:** a saved draft, upload, generated image or derived version in My creations.
- **Persona / style:** reusable reference photos and guidance. A prepared profile adds an AI-written description, not trained weights.
- **Score:** five visual/packaging rubrics; partial scores retain unknown pillars. Not a CTR forecast or a measured probability.
- **Preview fixes:** reviewable edit instructions without an image-provider request.
- **Generate fixed image:** one API-rendered version using provider credits; original remains saved.
- **Resize:** full-image fit over a soft background; no AI generation.
- **Connections:** provider-key and agent-access management at /connect.
- **API activity:** persisted request status; uncertain outcomes should be checked before retrying.

Dynamic photo/reference counts now use1 reference /1 photo and plural otherwise. API-request caps have complete contextual wording. No localization framework or full translation is claimed; long Spanish persona names remain part of existing reflow coverage.

## Verification

TypeScript,69 unit/database/route/protocol cases, production build and22 browser cases pass. Existing tests were updated for new visible labels; no new string-mirroring unit tests were added. The diagnostic fixture now renders both blocked and ready plans: previewing either dispatches zero /api/generate requests, and the paid action stays explicit. Both states are test fixtures, not real provider results.

Actual rendered copy was opened in320px analysis, blocked/ready fix dialogs,390px persona dialogs,768px provider onboarding and1440px desktop views. The ready fix action wraps legibly into two lines at320px, retains its full meaning and is reachable through the dialog’s internal scroll. Existing tests also cover390/430/1024 layouts,80-character persona names, singular references, keyboard labels and reduced motion.320 CSS px covers reflow equivalent to200% of640px; native browser zoom was not tested.

A targeted Impeccable scan returned no findings during this pass. No CSS, motion recipe, provider implementation, cost, hosted permission or persistence contract was changed. The two existing UI Motion review findings (nested Escape/focus and keyboard press scale) remain open; this copy pass does not claim to fix them.

Fresh performance reports and release checks are recorded in PERFORMANCE.md, VALIDATION.md and the JSON reports. Local lab results do not establish field p75, native Safari/iPhone behavior or live provider quality. Real OAuth Allow/provider smoke and public multiuser activation remain pending in RELEASE.md. No paid provider requests were made for this work.
