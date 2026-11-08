# OpenPikzels engine hardening release
## Executive summary
CLI-native usage/model discovery, memory-only exhaustion gates, general MCP connections and private prompt cards are implemented in the local companion. The hosted studio keeps its existing provider-key storage, scoped OAuth server and Higgsfield connection.

## Implemented
1. Codex app-server initialize/initialized, account/rateLimits/read and paginated model/list. Claude official SDK supportedModels and experimental structured /usage, with old/current report-shape tolerance. Readings remain memory-only and show age.
2. Duration-based window classification; known 100% windows pause execution until reset or a 30-minute probe. Only actual structured model refusals hide listed models for six hours.
3. Official MCP SDK stdio/SSE/HTTP clients, own-agent-only placeholder resolution, scrubbed child environment, literal identity headers, locally installed npx package substitution, probe-before-save, credential-aware 401 handling.
4. Public HTTPS/DNS/socket validation, no automatic redirects, capability-protected loopback host bridge; Codex excludes SSE connections.
5. PKCE consent popup with a ten-minute encrypted HttpOnly SameSite=Lax cookie, resource/auth-server metadata, DCR/CIMD, nonce CSP and BroadcastChannel/postMessage completion. Exact resource-bound encrypted local token storage, single-flight refresh and fail-closed uncertain rotation. Advertised device-flow fallback.
6. Ten-minute idle connection pool with dial fingerprinting and twenty-second connection timeout.
7. Transcript-derived question, approval, service, private-key, sign-in and handoff cards. Zod validation tolerates JSON-string arrays and null optionals. First valid card ends the CLI turn; invalid calls do not pause it.
8. Private secret submissions re-read the exact pending card, reject unrequested names, encrypt values outside the transcript and return names/statuses only. Blank preserves the existing key.
9. Per-family capability settings, non-blocking notifications, exact-action one-use or explicit standing approvals, revocation, denial enforcement and cancellation before upstream dispatch.
10. Updated setup page and downloadable self-contained Node companion with pinned source dependencies and third-party notices.

## Verification
1. 50 companion tests pass, including OAuth code-exchange/PKCE/replay fixtures, SDK client-to-host-bridge calls, device activation, rotating refresh concurrency, resource binding, escaped secret redaction, denial, approval races, cancellation and malformed usage shapes.
2. 77 app tests pass. TypeScript and production Next.js build pass. 28 studio browser tests pass.
3. Companion browser fixture checks pass at1280,320 and390 pixels with reduced motion; masked private key save, transcript privacy, discovered model/effort picker, question reply and approval denial verified. Rendered desktop and mobile screenshots visually inspected.
4. Real installed Codex: read-only discovery returned eight models and a weekly window. One actual text task through the new bridge returned text successfully. No image generation or Jev inference was performed by this release.
5. Local-runtime dependency audit reports zero known vulnerabilities. Native CLI binaries and vendor credential files are neither distributed, modified nor opened by the app.

## Limits and decisions
1. Claude personal sign-in was explicitly waived. Its official button/adapter exists; live Claude usage and inference were not validated on this unsigned account. Experimental or older reports can legitimately be unavailable.
2. Generic OAuth/device flows were validated with fixtures, not personal provider consent. A user must still consent to each provider's actual scopes.
3. No scheduler existed. This release adds reusable gates and persistent paused-card state, but creates no scheduled or webhook jobs.
4. New local MCP tokens are encrypted outside the app database. Existing hosted Higgsfield encrypted storage is a separate integration and was preserved.
5. The local vault uses a0600 file key, not OS Keychain; archive is source/Node distribution, not a signed installer. No Windows package.
6. Rerun protocol ideas were implemented in original code; no AGPL source was copied.
7. Deferred minor: settled per-agent promise queue entries are retained in memory.
8. Deferred minor: a remote response stalled after headers can remain pending until caller cancellation/timeout.

## Links
1. Studio: https://openpikzels.com
2. Connections: https://openpikzels.com/connect
3. Setup/download: https://openpikzels.com/local-companion
4. Remote MCP: https://openpikzels.com/mcp
5. Local companion CIMD: https://openpikzels.com/integrations/local-companion/client.json
6. Source: https://github.com/derrick-ships/klickz/tree/main/apps/openpikzel
