# OpenPikzels Remote MCP Server (v2.0.0)

OpenPikzels exposes a remote Streamable HTTP MCP server at `https://openpikzels.com/mcp` with OAuth 2.1 + PKCE and Dynamic Client Registration. Connected agents (Claude, ChatGPT, Codex, Cursor, Antigravity, or custom MCP clients) can operate the entire **Pre-Production Packaging & Audience Intelligence Platform** and **Quick Thumbnail Studio** end to end.

## Endpoints

- MCP endpoint: `https://openpikzels.com/mcp`
- Protected Resource Metadata: `/.well-known/oauth-protected-resource/mcp`
- OAuth Authorization Server Metadata: `/.well-known/oauth-authorization-server`
- OAuth registration: `/oauth/register`
- OAuth consent screen: `/oauth/authorize`
- OAuth token & refresh: `/oauth/token`
- Keys, per-leg models, and connected agent grants: `/connect`

## OAuth Scopes

- `studio:read` — Read channels, 16 Minds, Pre-Flight Studies, Executive Reports, personas, styles, creations, and scores.
- `studio:write` — Edit Minds and Creator Personas, configure per-leg models, toggle report sharing, email reports, upload references, promote report winners to Studio, and resize thumbnails.
- `studio:ai` — Run channel ingestion, launch async 3-leg Pre-Flight Studies, generate/recompose thumbnails, and score or fix packaging using your own connected BYOK API keys.
- `studio:agent` — Local companion persistent memory (`remember_fact`, `recall_facts`, `forget_fact`).

## Complete Toolset (50 Tools)

### 1. Workspace & Per-Leg Model Routing
- `get_workspace` — Full readiness snapshot (connected keys, per-leg models, linked channels, ready audiences, Creator Personas, active/completed studies, Resend/Inngest availability, and agent guide).
- `get_model_preferences` / `set_model_preferences` — Inspect and configure which models power `image`, `mediator`, `reviewer`, `scorer`, `minds` (Leg B), and `strategist` (Leg C).

### 2. YouTube Channels & 12–16 Synthetic Minds
- `connect_channel` — Ingest or refresh a YouTube channel (URL, `@handle`, or `UC...` ID) via Inngest to extract outliers, comments, transcripts (native Gemini or Transcript API), audience distributions, and 16 persistent Minds.
- `get_channel_ingestion_status` — Track live ingestion phases, percent complete, and timeline events.
- `list_channels` / `get_channel` — Inspect linked channels, audience distributions, outlier patterns, top 20 videos, and all 12–16 Minds.
- `update_mind` — Edit any Mind's `name`, `role`, `click_bar`, `skepticism_triggers`, `thinking_patterns`, or `active` toggle (enforces at least 12 active Minds).
- `delete_channel` — Permanently delete a linked channel and its audiences.

### 3. Creator Personas & Styles
- `update_persona` — Set `tone_of_voice`, `visual_style_rules`, `defaultStyle`, `notes`, and `name`.
- `list_profiles` / `get_profile` / `get_profile_refs` / `save_profile` / `prepare_profile` / `study_style` / `browse_style_channel`.

### 4. Pre-Flight Studies & Async Triangulation Engine
- `get_default_questions` — Fetch the bilingual (`en` / `es`) 8-question diagnostic set.
- `estimate_study_cost` — Upfront honest `Minds × Questions`, AI thumbnail render count, and BYOK USD estimate.
- `launch_preflight_study` — Fire-and-forget 3-leg triangulation study (`pre_shoot` or `footage_locked`), with optional `draftImage` / `draftThumbnailPath` / `draftImageUrl` for a blind Option A head-to-head battle against 2 AI challengers, plus optional `notifyEmails` for team CC.
- `list_studies` / `get_study_status` — Track live study runs, pipeline audit events, partial Leg A thumbnails, and final report links (renders live card in MCP Apps hosts).

### 5. Executive Reports, Team Handoff & Quick Studio Bridge
- `get_preflight_report` — Full Executive Verdict (`SHIP` / `ITERATE` / `RETHINK`), Click Share (including `none_keep_scrolling`), Retention Cliff warning, Angle Diagnosis, Packaging Matrix with Designer Redlines, and filterable Voice of the Minds (renders interactive Executive Report card in MCP Apps hosts).
- `get_report_markdown` — Clean bilingual Markdown (`.md`) brief for Notion, Docs, or Slack.
- `get_report_deliverables` — Fresh 1-hour signed download URLs for the PDF, Markdown, and all 3 high-res thumbnails.
- `set_report_visibility` — Toggle unlisted public sharing (`/reports/:slug`) vs private owner-only.
- `email_preflight_report` — Send or resend the Executive Report email with PDF + Markdown attachments via Resend to any team emails.
- `promote_option_to_studio` — Import any Option A/B/C from a Pre-Flight Report directly into Quick Studio (`studio_creations`) so the agent can immediately run `one_click_fix`, `get_fix_prompt`, or `recompose_thumbnail` (`9:16` Shorts).

### 6. Quick Thumbnail Studio & Memory
- `generate_thumbnail`, `analyze_thumbnail`, `score_thumbnail`, `create_fix_plan`, `one_click_fix`, `get_fix_prompt`, `recompose_thumbnail`, `resize_thumbnail`, `compare_variants`, `record_comparison`, `enhance_prompt`, `upload_reference`, `create_upload_url`, `list_creations`, `get_creation`, `list_jobs`, `list_conversations`, `get_conversation`, `create_conversation`, `open_studio`, `remember_fact`, `recall_facts`, `forget_fact`.

## MCP Resources & Resource Templates

- `openpikzels://agent-guide` — Full agent operating playbook.
- `openpikzels://workspace/overview` — Live JSON workspace readiness snapshot.
- `openpikzels://channels` — Linked channels and audience readiness index.
- `openpikzels://studies` — Recent Pre-Flight Studies and report slugs.
- `openpikzels://channels/{channelId}` — Full channel metadata, distributions, outlier videos, and 12–16 Minds.
- `openpikzels://reports/{slug}` — Structured Executive Pre-Flight Report JSON.
- `openpikzels://reports/{slug}/markdown` — Clean Markdown Executive Brief.
- `ui://openpikzels/analysis.html` — Interactive MCP Apps widget (supports both Single-Thumbnail Analysis cards and Executive Pre-Flight Report / Live Progress cards).

## MCP Workflow Prompts

- `onboard_channel` — Guided end-to-end YouTube channel ingestion and 16 Minds calibration.
- `run_preflight_study` — Guided end-to-end 4-stage Pre-Flight Study intake, cost check, launch, and Executive Report handoff.
- `footage_locked_rescue` — Zero-reshoot cold-open pull quote and 3 packaging pivots workflow.
- `head_to_head_thumbnail_battle` — Blind Option A draft thumbnail vs 2 AI challengers battle, then promote winner to Studio.

## Security Rules

- API keys are never passed through MCP tools or chat. Users save encrypted keys in `/connect`.
- Access respects `ACCESS_MODE` (`invite_only` via `studio_invites` or `public`), enforced identically across web auth and OAuth consent.
- OAuth grants are revocable anytime in `/connect`.
