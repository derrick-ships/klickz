# OpenPikzels
<!-- impeccable:product-schema 1 -->
## Platform
web
## Users
Derrick and creators packaging long-form YouTube videos and short-form content.
## Product Purpose
Create, recreate, edit, analyze and improve thumbnails and video titles in one private workspace.
## Stack
Existing Next.js App Router, React, Supabase Database/Auth/Storage, OpenAI Images/Responses, Jev decision API; Vercel deployment delegated to the agent.
## Capabilities and Constraints
Prompt, recreate, analyze, edit and title modes. Image references by upload, library and public URL. Batch size 1/2/4. Sunburst and Flare. Long-form and short-form; immediate resize. Reusable personas and styles. Five-pillar image-and-title evaluation: virality, clarity, idea, curiosity, emotion. One-click fix must preserve the original. AI ratings are rubric estimates, never measured CTR or conversion guarantees. Identity profiles use reference-guided generation; no fine-tuned image weights are claimed. Hosted previews retain the owner gate. Public release uses per-user RLS and encrypted BYOK connections without changing unrelated existing app policies.
## Brand Commitments
Name: OpenPikzels. Red accent in the YouTube family. Faithfully follow the captured Pikzels app layout, dark surfaces and compact controls; replace the earlier Frame identity completely. The user supplied this direction and explicitly delegated implementation decisions.
## Evidence on Hand
Pikzels app observed in cloud browser on November 7, 2026: narrow sidebar, chat history, bottom persona/style/model/format controls, central five-mode pill switcher, reference uploader, prompt, split generate/batch action. Existing generated Frame code, tests and local data store. No measured performance data or testimonial assets supplied.

## Account and MCP extension
Per-user OpenAI, Google and Jev API keys; OAuth 2.1-style S256 PKCE consent, resource-bound tokens, dynamic registration, Streamable HTTP /mcp, MCP Apps HTML studio and copyable fix prompts for ChatGPT. Domain openpikzels.com; the interface is deployed to production. Public provider-key storage, AI activation and full real-client OAuth validation remain pending.

## Public activation
Production uses per-user encrypted API connections with write-only replacement boxes and same-page email-code sign-in. New users own their rows and private storage; paid calls use only their own provider accounts. Higgsfield uses a separate encrypted OAuth connection. Claude/Codex subscription usage stays in the official clients through MCP; direct hosted plan sign-in requires vendor support/approval. See ACTIVATION.md.
