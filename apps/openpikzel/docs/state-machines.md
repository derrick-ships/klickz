# OpenPikzels state-machine audit — 2026-11-08

Scope: the current app source, backend routes, migrations, MCP tools and packaged local-companion source were inspected. This is a source-based inventory, not a claim that every possible runtime interleaving has been explored. No schema migration, provider call or credential change was necessary.

## Changes justified by observed failures

1. Explicit Save draft acknowledged completion before its conversation checkpoint was durable. An immediate reload restored an empty prompt. The new welcome continuity test failed before the fix. Save now checkpoints the latest controls and selected creation before its receipt, preserving edits made during slow writes; serialized conversation writes retain manual titles and lineage.
2. A delayed account-A resize surfaced an old-owner error after account B had hydrated. The strengthened existing race test failed before the fix. Operation errors are now scoped to the owner epoch, and owner changes clear prior errors. Authenticated capability responses also check their originating epoch and effect lifetime.
3. Durable job states were translated separately for humans and agents, and agents only received raw strings. A single read-only jobGuidance contract now supplies labels, nextAction, explanation and automaticRetryAllowed:false to the UI, REST and MCP. Unknown states fail closed to inspection. This does not change dispatch behavior or interpret a failed partial batch as safe to retry.
4. The new entry flow has explicit fresh, returning and legacy-link transitions. It retains query parameters and uses only an internal destination. Its cookie is a nonsecret navigation preference; it never grants access or erases drafts.

## Inventory and transition contracts

1. Entry: fresh root → welcome → studio → remembered studio; /welcome is always available; valid legacy mode links redirect to /studio preserving parameters. Cookie denial leaves direct studio usable. Files: app/page.tsx, app/studio, app/welcome.
2. Configuration bootstrap: unknown → local/cloud settings → authenticated capability refresh; network failure retains local drafts. Account-scoped refresh results must not cross owner epochs. File: lib/use-studio.ts.
3. Account hydration: local or account A → loading → owner collection/images → ready; account change clears the prior owner’s data and increments version/epoch. Stale reads must not hydrate a new owner. Tests: workspace-races.
4. UI operation gate: idle → locked running → success/error → idle. The lock is synchronous; one overlapping UI action cannot dispatch a second provider task. Old-owner errors are ignored. Busy remains until the in-flight task settles; switching accounts does not cancel a paid dispatch.
5. Conversation hydration: owner unknown → saved chat lookup → activate exact draft → ready. Only the owner’s active-chat key is read. Existing storage names and IDs are unchanged.
6. Conversation writes: draft dirty → debounce → serialized write → saved/error; manual title and latest selection are merged. Explicit save additionally checkpoints before its success receipt. Draft changes after submission are not overwritten by the completed receipt.
7. Chat navigation: current draft → flush → activate/create → restore controls/focus. Busy generation disables competing chat/library navigation. Failure retains the original session.
8. Creative modes: generate/recreate/edit/analyze/title; mode determines required references, primary action and inputs. Existing image/title context stays in the workspace.
9. Draft receipt: unsaved → saving → saved → timed fade; editing the fingerprint invalidates the receipt. Keyboard and reduced motion preserve feedback without animation.
10. Reference upload/import: select/link → validate/decode/resize → private/local asset → attach or error. Accepted PNG/JPEG/WebP, size and pixel limits remain enforced. Remote URL fetch uses validated backend restrictions.
11. Image generation request: intent snapshot → stable request ID → reserve → dispatch → result/partial/error/uncertain. No automatic retry after ambiguous dispatch. Paid backend idempotency persists independently of browser memory.
12. Durable jobs: queued → running → succeeded/failed/reconciling; expired queued/running → reconciling. Ready result replay requires identical digest. Request ID/owner/operation/dispatch cap/deadline are immutable. The current SQL validates values and identity, not every possible graph edge; arbitrary client updates remain an explicit hardening candidate requiring a reviewed migration.
13. Image variants: draft/generating → ready/failed/reconciling; ready content/settings/lineage are immutable in the database. Edit/fix/resize create children; originals remain available.
14. Analysis: idle → analyzing → signed diagnostic → pillar detail. Missing title/brief evidence yields partial/null scores; small actual previews and uncertainty remain visible. No CTR prediction.
15. Fix planning: choose source → preservation constraints → signed review token → apply/export prompt. Changed source/title/settings invalidates approval. Applying produces a new variant, not an in-place replacement.
16. Blinded review: choose two variants → blind token → A/B/tie/inconclusive → record. The token binds variants and a preference does not establish CTR uplift.
17. Before/after: ready images → slider drag/keyboard/gesture → compare; decode failure offers recovery. Alignment uses a common frame. Pointer cancellation and reduced motion are covered by existing gesture tests.
18. Image inspection: fitted → zoom/pan → reset; pointer/pinch ownership is scoped to the surface. A failed image is a distinct recoverable state. File: creative/image-inspector.tsx.
19. Responsive navigation: desktop open/collapsed; compact closed/open; keyboard/pointer and reduced motion select transitions. Main remains mounted, blurred and inert behind compact navigation. Escape/scrim restores opener focus; resize resets layout deliberately.
20. Native dialogs: closed → open named dialog → change view/submit → close → focus return. Model picker has search/empty/selected states and explicit Safari opener focus. Existing native dialog handles focus containment and Escape.
21. Composer: empty/active-image → expanded/collapsed; user can edit next prompt while a submitted request retains its snapshot. Mobile has one column; desktop canvas/inspector share the selected variant.
22. Persona tutorial: step 1→2→3 or skip; optional persisted skip preference; failure stays in tutorial. Persona form requires name, three distinct images and likeness permission.
23. Persona/style profiles: library → tutorial/create/upload/YouTube → saving → saved/error; draft references → prepared identity/style brief. Preparing describes references, not fine-tuning. Failed pre-dispatch upload attempts clean staged assets; uncertain dispatched saves retain data for inspection.
24. YouTube source: channel query → lookup → recent/popular page → three selected references → import → private style. Busy controls prevent normal overlapping requests; selections persist across pages. API errors retain the form and selections.
25. Feedback: editing → validating → saving → saved/error; failures retain text. It is private workspace feedback, not an email or training submission.
26. Account sign-in: password/signup/email-code → pending → authenticated/confirmation/error/rate-limited. Code entry can use an already received code; 429 does not invent success or resend automatically.
27. API key connection: unavailable/stored → masked replacement → encrypted write → stored suffix/status. Blank retains the existing key; there is no plaintext readback. Delete is separate. API/owner isolation is enforced on the server.
28. MCP authorization: metadata/client registration → PKCE authorization request → authenticated Allow/Deny → one-use code → access/refresh → rotation/revocation/expiry. Consent scopes are enforced by tools; refresh/code replays are rejected. OAuth fixtures are not live external-provider verification.
29. Higgsfield: disconnected → short-lived sign-in state → provider consent → atomic state consumption → encrypted connection → lease-bound tool discovery/refresh → disconnect/reconnect. Refresh is serialized by a database lease; ambiguous provider outcomes require reconnection/inspection.
30. Local companion authentication: official CLI unavailable/signed out/signed in; app launches the unmodified CLI flow and never copies plan tokens. Browser-launch smoke tests do not prove an end user completed sign-in.
31. Plan telemetry: no reading/fresh/stale → exhaustion latch → reset or 30-minute probe; listed model actual refusal → six-hour hide; failed discovery never hides models. Memory-only readings. No scheduler is implemented.
32. Local MCP registration/pool: resolve agent-owned secrets → approve destination → probe → save or needs-sign-in/reject; idle connections close; dial fingerprint changes redial. Engine process environment is excluded and child environment is scrubbed.
33. Local MCP OAuth: discover → PKCE popup/device path → callback → encrypted local tokens → single-flight refresh → authorized/reconnect. Pending state expires; popup completion has BroadcastChannel and postMessage fallbacks.
34. Human cards: valid call → persisted pending → halt → answer/dismiss → resume; malformed cards never become pending. Private secrets recheck requested names, store outside transcripts and return names/statuses only.
35. Agent tool approval: ask → pending/deny/allow-once/standing → consumed → dispatched/uncertain. Denial blocks workarounds; cancellation cannot undo a tool already sent.
36. Brand motion: still → visible eligible desktop one-shot → settled; hidden tab, form focus, reduced motion, save-data or mobile settles to still. No endless video or blocking splash.

## Evidence and remaining limits

Existing regression families cover OAuth replay/PKCE/scopes, key isolation, paid job concurrency/replay, database lineage, partial diagnostics, preservation plans, workspace races, gestures, mobile layout, native dialogs and private profiles. This release adds fresh/returning/legacy entry coverage, immediate explicit-save reload, stale-owner alert suppression, and shared job-policy checks. Final counts and measured performance are recorded separately in the release evidence.

Deferred rather than silently refactored: a database-enforced full job edge graph; durable recovery UI for every uploaded orphan; queued profile/tutorial cancellation; exact face preservation; a signed cross-platform companion installer; a real scheduler; real provider consent/plan-limit validation for every possible account; and cross-tab conflict resolution beyond existing serialized writes/owner isolation. The companion’s pre-existing unbounded settled queue bookkeeping and stalled-body timeout limitation remain documented. No state-machine library was added merely to replace working booleans.
