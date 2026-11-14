# OpenPikzels MCP

The public-domain target is `https://openpikzels.com/mcp`. Domain connection and HTTPS are complete, and non-custom previews retain Vercel Authentication. **A real authenticated MCP Allow/refresh/tool sequence has not been verified, and hosted studio access is still restricted to the owner.** Do not treat domain routing as proof of a completed public multiuser release.

## Connect after public release

1. Open `/connect`, create/sign into your account, and connect your own provider keys. OpenAI or Google powers creation/vision/titles; Jev powers scores. API credits are separate from consumer chat subscriptions.
2. Paste the MCP URL into a client supporting Streamable HTTP and OAuth. Examples include compatible Claude, Cursor and Codex configurations; client-specific UI and MCP Apps support vary.
3. Sign into the branded consent page and choose Allow or Deny. This sign-in creates a separate account session for that agent, so its refreshes do not interfere with the studio or other agents.
4. Revoke the agent from `/connect` anytime. No provider key is sent to an agent or embedded in the HTML widget.

## Copy these instructions into your agent

> Connect to the OpenPikzels remote MCP URL. Never request API keys in chat; direct me to the app's Connections page. Start with `get_workspace`. Use `list_profiles` and `get_profile` for my consistent persona/character pictures and styles. Upload an image made in ChatGPT with `upload_reference`, then `score_thumbnail` with a stable request ID, actual title and factual video brief. Vision critique is an explicit optional extra provider call. Use `get_fix_prompt` to return an editing prompt I can copy into ChatGPT without making a new image API request. Use `create_fix_plan` to review at most three supported changes and preservation constraints; apply its exact token through `one_click_fix` only when I request the one-image API render. Use `generate_thumbnail` for requested fresh images with my chosen provider, quality and batch. Use `compare_variants` and `record_comparison` for a blinded human review; retain both images. Preserve the request ID after a timeout and check `list_jobs` and provider history before a new paid attempt. Never automatically retry uncertain outcomes. Scores are five visual rubrics, not promised CTR. Use `open_studio` for the interactive HTML workspace when the host supports MCP Apps.

## Tools

| Tool | Purpose | Required permission |
| --- | --- | --- |
| `get_workspace`, `open_studio` | Capabilities, guide, HTML app | Read |
| `list_creations`, `get_creation` | Saved work, scores, 5-minute private previews | Read |
| `list_profiles`, `get_profile` | Persona/character and style references | Read |
| `upload_reference`, `save_profile` | Private uploads and profiles | Write |
| `prepare_profile` | Reference-guided identity/style brief | Write + AI |
| `suggest_titles` | Five title ideas | AI |
| `generate_thumbnail` | Prompt, title, recreate or edit | Write + AI |
| `score_thumbnail` | Actual image/title Jev evaluation | Write + AI |
| `analyze_thumbnail` | OpenPikzels Analyze: score a creation, uploaded path, or small base64 image, then return a fix plan | Write + AI |
| `create_upload_url` | Short-lived signed upload URL; pass the returned imagePath to analyze_thumbnail | Write |
| `get_fix_prompt` | Copyable improvement prompt from a saved score | Read |
| `create_fix_plan` | Review evidence-backed changes and preservation constraints; no AI call | Write |
| `one_click_fix` | Apply a reviewed plan token as one new image; original preserved | Write + AI |
| `compare_variants`, `record_comparison` | Randomized human A/B comparison; no AI call | Read / Write |
| `list_jobs` | Persistent request state and timeout reconciliation; no retry | Read |
| `resize_thumbnail` | Contain/blur horizontal↔vertical resize, no image API | Write |

Generation uses one Low image by default. Batches are capped at four. MCP inline uploads accept PNG/JPEG/WebP up to 2 MB, browser storage uploads up to 5 MB. Images must decode within 40 megapixels. Google renders native 1K; OpenAI quality/intelligence controls do not apply to Google.

Jev-only scoring makes a single Jev request and returns rubric-based edit guidance. Only when `includeVision=true`, a separate connected OpenAI or Google vision request adds image-specific observations. Missing title/factual brief leaves idea and curiosity unassessed and the overall score null. API fix plans require a complete signed diagnostic with supported evidence. The UI does not claim real analytics, measured CTR or fine-tuning.

## Mode B: named profile references (`get_profile_refs`)

`get_profile_refs` requires `studio:read` and existing authentication and revalidation. Mode A generation by profile name is not claimed available.

Provide up to three persona names in `personas` and optionally one private style name in `style`; supply at least one. Names must not be blank; persona names must be distinct after trimming and case normalization. Resolution searches the caller-owned profiles, not public presets. Ambiguous names require a rename. No `@` parsing is performed. Results preserve persona request order, followed by style. Profiles without references have an empty list; only the first three stored references per profile are included.

Successful results contain profile kind, name, ID, brief and notes, plus paths and signed URLs associated with inline JPEG blocks by `imageIndex` (zero-based among image blocks). There can be at most 12 images, resized inside 768 pixels without enlargement, JPEG quality 80. Links are intended to expire after 300 seconds. If any selected reference cannot be used, the entire call fails rather than returning partial metadata or images.

This tool discloses private images, identity briefs, notes and bearer URLs to the requesting MCP host and model. Hosts may omit image blocks, retain or forward data. URL expiry cannot revoke copies already received. Use only with a trusted host. Actual storage signing and expiry require isolated non-production verification.

## Protocol and security

- Streamable HTTP POST `/mcp`; JSON responses; stateless serverless transport, no persistent SSE connection required. GET/DELETE return 405 after authentication. OPTIONS supports preflight. Unauthenticated requests return a Bearer challenge with resource metadata.
- Protected resource metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`; authorization server discovery at `/.well-known/oauth-authorization-server`.
- Dynamic public client registration `/oauth/register` (RFC 7591); exact HTTPS redirect matching with HTTP loopback exceptions, public clients with token auth `none`. DCR client IDs are authenticated encrypted metadata documents, so registration does not require a database write. CIMD is not implemented because DCR satisfies discovery requirements.
- `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`; authorization code with mandatory S256 PKCE, exact resource parameter binding, 90-second single-use codes, 15-minute access tokens, rotating refresh tokens, 30-day grant expiry, grant revocation and replay tracking.
- Authenticated encrypted opaque tokens are bound to `APP_ORIGIN/mcp`, client, account, grant and permission scopes. Raw Supabase session tokens and provider secrets are never returned to an MCP client. Native Supabase OAuth tokens are rejected by the app.
- Consent requests are time-limited, authenticated and bound to an HttpOnly SameSite cookie plus exact app Origin. Unregistered redirects never receive codes. Third-party client names are explicitly identified as self-supplied.
- AES-256-GCM per-user provider ciphertext is bound to user ID and provider; a 32-byte server key also seals purpose-separated OAuth payloads. Keep this key stable and backed up in a secret manager. Rotating it invalidates connections and requires re-entering encrypted provider keys.
- All app data stays behind RLS and private storage. No service-role credential is used. Backend routes enforce scopes independently of tool wrappers. Unrelated existing app/notes policies and private allowlists are unchanged.
- MCP Apps resource `ui://openpikzels/studio.html`, MIME `text/html;profile=mcp-app`, uses the official bundled Apps SDK bridge. CSP permits only the configured Supabase image origin; no external scripts or direct API calls. Compatible hosts proxy tool requests with their user grant. Text-only clients still get every tool.

Supabase's native OAuth server currently does not bind tokens to RFC 8707 resource audiences ([upstream issue](https://github.com/supabase/auth/issues/2610)); this app implements its own resource-bound authorization layer over Supabase accounts. Production requires real-client OAuth verification before claiming interoperability with a particular host.

## Free-tier considerations

No extra always-on server, paid OAuth service, Supabase branch, Redis or billing upgrade is required. Vercel/Supabase still have usage quotas; hosting, storage, email delivery and provider APIs are not unlimited. Before a broad launch, configure suitable Supabase email delivery/rate limits, monitor quotas, and apply project-level abuse controls. DCR is stateless and request-body bounded, but edge rate limiting remains an operator deployment setting.

## Optional official local CLI companion

The setup page is /local-companion. The downloaded companion runs separately on the user's own computer. It launches unmodified official Claude Code/Codex processes after their own sign-in. Their subscription credentials are not collected by OpenPikzels. Local text tasks can use the CLI's eligible active plan; an API-key login uses API credits instead. This optional flow is separate from remote MCP and hosted provider execution. The companion does not expose the local CLI to remote MCP clients or perform visual scores/image generation.
