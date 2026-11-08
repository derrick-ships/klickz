# Product workflow release — 2026-11-08

OpenPikzels extends the existing red/charcoal review studio into a persistent creative workspace. The reference is Derrick's written analysis of three mobile recordings; no source recordings or frame images were attached. This release does not claim frame-exact matching or access to Pikzels' implementation.

1. Chats: New Chat, search and date groups, manual names, autosaved drafts, reload restoration, chronological prompt/image turns and durable conversation associations. Switching flushes pending edits. Submitted operations lock context changes; stale account completions cannot contaminate another user's workspace.
2. Image workflow: Prompt, Edit, Recreate, Title, uploaded/linked references and existing generation providers remain available. Inspect, download, resize and before/after comparison sit beside the active image. The slider supports touch and arrow keys; existing blinded preference comparison remains available.
3. Analysis: five segmented pillars, optional/null evidence, expandable explanations, copyable improvement instructions and the existing reviewed one-click fix. Scores are creative assessments, never CTR predictions. Immutable parent lineage and preservation constraints remain intact.
4. Personas: three-step photographic guide with Next/Skip/persistent don't-show preference; name minimum three characters; exactly three different photos; likeness permission; recoverable errors and private storage. These are reference-guided profiles, not model training.
5. Styles: Public original app directions and Private owner profiles; exactly three uploaded thumbnails or official YouTube channel lookup, channel metadata, Recent/Popular browsing, pagination and three-reference selection. Selected images are copied into owned storage. A separate encrypted per-user YouTube Data API key is required; there is no global owner-key fallback.
6. Feedback: thumbnail-associated private text form, inline errors and saved receipt. No support email or model-training submission is implied.
7. State and access: additive conversations/preferences/feedback tables, owner RLS and composite owner foreign keys; safe IndexedDB v1 upgrade. Web writes require same-origin; OAuth tools require scopes. Profile references are owned, decoded and checked for duplicate image content. MCP exposes conversation and channel browsing tools.
8. Visual quality: original red brand, dotted surfaces, branded art, responsive modal controls, visible keyboard focus, reduced motion and original Persona photo examples. Decorative mobile video is replaced by its existing branded still to protect loading performance; desktop keeps the finite animation. Dialog modules load when needed. The database SDK loads only after the app confirms a cloud connection is needed.

Excluded by request: credits, trials, payments and upscaling. No fabricated 4K labels or provider percentage progress were added. Progress uses the real operation label and elapsed time.

## Review and validation

A fresh reviewer found four context/draft/account issues; regression tests reproduce and verify each fix. The related manual-title race was fixed in the same partial-write pipeline. Desktop and mobile rendered screenshots were manually inspected, including 320px and 390px dialogs, the reference picker, comparison and analysis. Tests also cover 375/414/430/768px and wide desktop layouts. The authorized Mac's production build and Playwright browser were used because the cloud browser cannot reach that device's loopback server.

The additive migration `20261108131745_creative_workspaces.sql` was applied to the existing Supabase project. All three new tables have RLS. Security-advisor findings remained unchanged: existing access helper warnings and leaked-password-protection configuration; no new finding from these tables. Unrelated project data was preserved.

Verification totals and measured performance are recorded in `evidence/product-workflows-release.json`. Lab measurements are controlled samples, not field p75 or a production SLA.

## Fidelity ledger

1. Brand and surfaces: preserved existing OpenPikzels red, charcoal, typography and original art; selected reference cards use the app's red outline/check.
2. Workspace anatomy: persistent image/composer context, mode-dependent inputs, compact image toolbar, image-associated title and settings.
3. Dialog anatomy: branded dark overlays with visible heading/close; three-step guide, feedback, analysis and aligned comparison.
4. Selection and recovery: exactly-three selection prerequisite, distinct-photo validation, name-field error and form retention.
5. Analysis anatomy: overall/partial score, five segmented pillars and More disclosures. Missing evidence stays unassessed.
6. Async behavior: retained context, immutable request parameters and real operation states; no invented provider percentages.
7. Fidelity limit: the written description supports workflows and visual anatomy, but cannot establish exact spacing, animation timing or original recording pixels.

## Remaining validation limits

1. YouTube lookup and saving were verified with route tests and explicit browser fixtures. A real quota-enabled user YouTube key was not connected or charged in this release; live provider success is not claimed.
2. Existing image generation, Jev scoring and profile preparation were preserved; no paid image/scoring call was performed for this UI release. Provider likeness/style fidelity is not guaranteed.
3. Persona images in the tutorial are original synthetic examples generated for OpenPikzels. Uploaded user references remain private.
4. Production smoke checks verify deployed routes, metadata, assets and fresh-browser UI; they do not replace a signed-in real-provider run.
