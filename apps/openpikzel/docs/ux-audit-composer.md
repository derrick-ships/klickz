# November 9 composer and edit-context release

Implemented the three requested improvements from the November 8 desktop audit. That audit was one observation, not a prevalence study.

## Request clarity
The composer shows the configured provider/model ID, image quantity and format, connection/input readiness, and an explicit statement that spend cannot be estimated reliably before the request. It does not present a saved API key as verified model access or available balance, and it makes no invented price or timing promise.

A single shared image-model catalog now supplies both picker/trigger labels and backend request IDs. Existing routes are preserved:
- Flare 2.6 / OpenAI: gpt-image-2.6-flare
- Sunburst 2.6 / OpenAI: gpt-image-2.6-sunburst
- Gemini Flash / Google: gemini-3.1-flash-image
- Gemini Pro / Google: gemini-3-pro-image

This verifies the application's mappings, not an account's provider entitlement. Text/scoring identity comes from the server's actual configured model names. No paid inference was run for this UI release.

## One settings home
Model and format remain editable in the composer. Sidebar duplicates were removed, along with its redundant Connections controls and the footer's duplicate workspace-settings action. The top-bar Connections entry remains. Prompt typography remains 16px; existing motion rules were retained.

## Editing context and retention
The selected source appears alongside Edits on desktop and in a collapsible preview on narrow screens. The redundant small upload preview is hidden in this state; Upload, Link and Library still change the source.

Opening Edit no longer clears an unsent brief. An edit request now gives the currently selected image priority over an older parent ID, preventing a stale source from disagreeing with the preview after a library selection. Saved draft parent fallback remains available.

## Validation
Unit/database tests cover provider mappings and readiness branches. Browser checks cover settings ownership, provider/model labels, unknown spend, 16px prompt text, Prompt–Title–Prompt retention, edit-source continuity, reload/autosave, source-switch payloads, account isolation, provider onboarding, downloads/resize and existing motion/reduced-motion behavior.

Screenshots were inspected at 1440px desktop and narrow widths. These are browser tests and explicit fixtures, not physical-device or paid-provider validation. The original audit did not establish these additional outcomes; they were checked during implementation.

WebKit limitation observed: the local-upload setup failed while persisting an image Blob to IndexedDB; decoding succeeded. The selected-image flow was therefore additionally tested in WebKit with explicit cloud-storage fixtures. Chromium local upload/reload tests passed. This release does not alter the local storage adapter or claim that WebKit local-upload recovery is verified.
