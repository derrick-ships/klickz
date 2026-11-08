# OpenPikzels local companion
Start OpenPikzels.command on macOS or start-linux.sh on Linux. Requires Node22+ and your unmodified official Codex or Claude Code executable. No background service is installed. Keep the launched browser tab private.

1. Official sign-in buttons launch the provider's own flow. OpenPikzels never opens vendor credential files or proxies subscription tokens.
2. Refresh reads Codex app-server account/rateLimits/read and model/list. Claude uses the official Agent SDK with your installed executable, supportedModels and experimental structured /usage. Missing/older fields show unavailable; no dashboard scraping and no model call just to read usage.
3. Usage/model readings are memory-only and show capture time. Known exhausted windows pause runs until reset, or a 30-minute probe if reset is unknown. Actual provider model refusals hide listed models for six hours; discovery failures do not hide models.
4. Choose a model/effort from the discovered catalog, or retain the CLI default.
5. Conversations and MCP configuration remain on this computer in ~/.openpikzels/companion. Credentials use a separate AES-256-GCM vault with a local 0600 key and agent-bound entries. This is file encryption, not macOS Keychain. Back up the key and vault together; do not share that folder.
6. Use the private key card: values are masked, never read back, and blank means keep the current value. Transcript replies contain key names and provided/skipped only. Do not paste credentials in briefs or headers.
7. Add a public HTTPS MCP URL, or approve an installed local command. A connection is probed before save. Unauthenticated 401 saves a needs-sign-in connection; rejected credentials do not save. npx never downloads a package: install it locally first.
8. Headers/args/env may reference named placeholders such as a dollar sign followed by {MY_KEY}. Only this agent's private environment, AGENT_WORKSPACE and PUBLIC_ENGINE_URL resolve. Engine process secrets are excluded. Credential-bearing registrations require approval of their destination.
9. Sign-in opens the server's own consent popup using PKCE, an HttpOnly SameSite=Lax 10-minute state cookie, metadata discovery, and DCR or CIMD. Tokens live in the local encrypted vault, outside the app database. Rotating refresh is single-flight; an uncertain refresh requires reconnecting.
10. Device sign-in is available only when advertised by the provider. Its private device code stays in the vault; the user-facing code is shown only in the local UI.
11. Official MCP SDK clients support stdio, SSE and Streamable HTTP. Connections idle-close after ten minutes; edited dial parameters or refreshed tokens redial. Codex omits SSE servers; Claude can bridge all supported transports.
12. In-process host tools are exposed as mcp__openpikzels__ask_user etc; connected tools retain their server-qualified names. Valid cards stop the turn. Answers/dismissals are normal transcript messages. Secret submissions re-check the exact pending card. notify is non-blocking.
13. Connected tool actions require approval. The default is one use; an explicit checkbox can allow only that exact action until you revoke standing approvals. A denial blocks the same action; cancellation stops a not-yet-dispatched action. Once dispatched, check the service before retrying an uncertain outcome.
14. No scheduler exists in this companion. The shared plan gate and paused-card state are reusable by future scheduled/webhook callers; this release does not create schedules.

CLI tasks can write titles, concepts and prompts. Connecting the OpenPikzels MCP adds its real backend tools (score, fix prompt, personas, generation) according to the scopes you consent to. Generation/scoring still use the user's API connections and may cost credits.

Verification distinguishes fixture OAuth/tool tests from real provider consent. Claude personal login is optional; no sign-in is required just to inspect the setup buttons. Windows packaging and a signed installer are not included.

Known minor limitations: settled per-agent queue entries remain in memory; a remote response that stalls after headers can remain pending until its caller cancels/times out. No performance, CTR or uplift predictions are made.

Third-party SDK licenses and notices are included. Rerun source was not copied.
