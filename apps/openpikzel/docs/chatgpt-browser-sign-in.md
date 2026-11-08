# Browser Codex connection

OpenPikzels implements a no-download Codex device-code connection at /connect#chatgpt.

## User flow
1. Sign in to the user's OpenPikzels workspace.
2. Continue with ChatGPT opens https://auth.openai.com/codex/device.
3. Enter the one-time code shown in OpenPikzels and approve on OpenAI's page.
4. The workspace polls automatically, then shows the masked account and plan.
5. Refresh usage and models reads metadata without requesting generation.
6. Cancel invalidates the current attempt. Disconnect erases this app's encrypted connection.

Popup blocking has an ordinary link fallback. OpenAI may require enabling device-code login in the user's security settings. OpenPikzels never asks for an OpenAI password.

## Scope and limitations
This is the Codex device protocol used by DSH/pi, not a registered OpenPikzels Sign in with ChatGPT partner integration. It does not establish provider approval for a hosted third-party service. No partner application was submitted.

This release connects the account and reads models/usage. It does not route studio generation, titles or scoring through the subscription. Those operations still use the existing per-user API connections. No inference request was made to validate this release.

References:
- https://github.com/WSL043/dsh-codex-subscription/tree/7795f5914b78363a0264652e240bd98354834c00
- https://github.com/earendil-works/pi/blob/main/packages/ai/src/auth/oauth/openai-codex.ts
- https://learn.chatgpt.com/docs/auth#login-on-headless-devices

## Storage and isolation
CODEX_DEVICE_ENABLED=true enables the route. STUDIO_ENCRYPTION_KEY is the existing server-only AES-GCM encryption key. Both pending grants and access/refresh tokens are encrypted with user-specific authenticated context. Browser responses contain only the temporary user code, fixed verification URL, masked identity, connection status, usage and model names. No tokens enter browser storage, logs, URLs or email.

studio_codex_connections uses auth.uid() RLS and a SECURITY INVOKER transition function. Native app sessions manage connections; delegated MCP OAuth sessions cannot. Mutation requests require the app origin. Usage/model readings remain in browser memory.

A row lock enforces attempt identity, 30-second start spacing, provider polling intervals and a single polling lease. An exchange is marked before execution and never blindly retried. Cancellation, replacement and disconnection invalidate late results. Token refresh uses a separate lease/version; an abandoned rotating refresh requires sign-in rather than reusing a potentially consumed token. An expired device grant is not returned; its encrypted pending data is overwritten on the next attempt or erased by cancellation/disconnection. Codes expire after 15 minutes.

## Validation
- Real provider start returned HTTP 200 and a schema-valid device grant. Its code was neither exposed nor approved.
- Unit fixtures test protocol validation, redaction, PKCE exchange fields, refresh and optional metadata.
- PostgreSQL tests cover isolation, polling lease, cancellation before completion, refresh single-flight and disconnection.
- Browser fixtures cover popup fallback, completion, metadata, cancellation races, expiry, mobile layout and reduced motion.
- Real completed sign-in, token refresh and subscribed inference remain unverified; fixtures do not establish those outcomes.

## Operations
Disable CODEX_DEVICE_ENABLED and redeploy to stop new connections. Disconnect removes the app's saved token bundle but does not claim provider-side revocation. Users can manage provider authorization in ChatGPT security settings.
