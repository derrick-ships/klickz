# OpenPikzels MCP

The planned public URL is `https://openpikzels.com/mcp`. **It is not publicly live yet.** The current deployment is protected by Vercel Authentication and the domain still points to GoDaddy parking. Native MCP clients cannot connect through the Vercel login wall.

## Connect after public release

1. Open `/connect`, create/sign into your account, and connect your own provider keys. OpenAI or Google powers creation/vision/titles; Jev powers scores. API credits are separate from consumer chat subscriptions.
2. Paste the MCP URL into a client supporting Streamable HTTP and OAuth. Examples include compatible Claude, Cursor and Codex configurations; client-specific UI and MCP Apps support vary.
3. Sign into the branded consent page and choose Allow or Deny. This sign-in creates a separate account session for that agent, so its refreshes do not interfere with the studio or other agents.
4. Revoke the agent from `/connect` anytime. No provider key is sent to an agent or embedded in the HTML widget.

## Copy these instructions into your agent

> Connect to the OpenPikzels remote MCP URL. Never request API keys in chat; direct me to the app's Connections page. Start with `get_workspace`. Use `list_profiles` and `get_profile` for my consistent persona/character pictures and styles. Upload an image made in ChatGPT with `upload_reference`, then `score_thumbnail` with its actual title. Use `get_fix_prompt` to return an editing prompt I can copy into ChatGPT without making a new image API request. Only call `generate_thumbnail` or `one_click_fix` when I request an API-rendered image, with my chosen provider, quality and batch. Preserve the request ID after a timeout and check history before retrying. Scores are five visual rubrics, not promised CTR. Use `open_studio` for the interactive HTML workspace when the host supports MCP Apps.

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
| `get_fix_prompt` | Copyable improvement prompt from a saved score | Read |
| `one_click_fix` | New improved API-rendered image; original preserved | Write + AI |
| `resize_thumbnail` | Contain/blur horizontal↔vertical resize, no image API | Write |

Generation uses one Low image by default. Batches are capped at four. MCP inline uploads accept PNG/JPEG/WebP up to 2 MB, browser storage uploads up to 5 MB. Images must decode within 40 megapixels. Google renders native 1K; OpenAI quality/intelligence controls do not apply to Google.

Jev-only scoring makes a single Jev request and returns rubric-based edit guidance. If OpenAI or Google is also connected, a separate vision request adds image-specific observations. The UI does not claim real analytics, measured CTR or fine-tuning.

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
