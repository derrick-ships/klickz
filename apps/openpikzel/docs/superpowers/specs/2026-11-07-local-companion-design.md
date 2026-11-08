# Official local CLI companion
Derrick requests use of each user's existing Claude/Codex subscription through official unmodified binaries. Existing approval covers implementation, main and deployment without repeated design approvals.

The hosted app cannot spawn a process on a visitor's computer. Add a separate local companion, served on 127.0.0.1:48763, with an accessible red/dark browser UI. Authentication runs in the official CLI's own terminal/browser flow. Read only documented CLI status, never credential files. The companion neither accepts nor forwards provider tokens to Vercel.

Support title ideas, thumbnail concepts and copyable edit prompts. These are text tasks; do not call them visual scores or image generation. Each run is explicit, one at a time, with cancellation and a timeout. Use argument arrays without a shell and send the brief on stdin. Claude gets no built-in or MCP tools; Codex gets an isolated read-only workspace, no user configuration and ephemeral output. Preserve authentication with the official binary. Never use bypass flags.

Serve no cross-origin API. Enforce loopback binding, exact Host/Origin, an ephemeral CSRF capability, small request bounds and no raw child stderr. Login launches an official process in a terminal, so the companion cannot capture its credentials. No scheduled service or autostart.

Chosen approach: small standalone Node companion, reusing the web brand. Alternatives: MCP-only is already available but does not provide this local workflow; a signed native installer adds packaging and signing prerequisites. Native packaging is a later improvement, not claimed complete.

Provide macOS and Linux launch files. Node 22+ and the selected official CLI must already be installed. Cloud execution alone cannot verify the user's Mac; use an authorized device connection when available. Fixtures must remain distinct from real subscription validation.
