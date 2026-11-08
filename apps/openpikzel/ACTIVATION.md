# Production connections and new-user activation

The user explicitly requested production AI, private per-user key storage, new-user access, full MCP OAuth, easy same-page sign-in and Higgsfield MCP. Existing app data and unrelated applications remain isolated.

## Implemented

- Production application encryption configured using the existing app key for the same database. No plaintext key is in source or reports. AI_ENABLED=true, OWNER_PROVIDER_KEYS=false. No shared owner-provider fallback exists in production.
- Approved migration openpikzels_public_users_and_external_mcp removed only the eight OpenPikzels preview-owner restrictions (including private storage), retaining each user's own-row/folder RLS, private buckets and immutable job/variant rules. Two new RLS-protected tables hold encrypted Higgsfield connection tokens and short-lived, single-use sign-in state. Other app owner restrictions remain.
- Production OWNER_GATE=false; preview remains owner-gated. Supabase new-user signup is enabled. Existing Site URL and redirect entries were preserved; canonical studio redirects were added.
- Existing AgentMail SMTP configured for transactional sign-in mail. Both the user's Gmail and a separate existing AgentMail test inbox received real signup/sign-in emails. Original one-time links are preserved; templates also include same-page codes. Password sign-in remains available. Code entry moves focus to the correct input and is available in isolated MCP consent sessions as well as the main account screen.
- API-key entry is write-only: saved values are never refilled or returned. Blank/whitespace retains an existing key; new connections require a complete key. Changing provider clears unsaved input. Plaintext clears immediately on submission. Browser/route tests cover these behaviors; database tests cover account isolation.
- Original Higgsfield OAuth client uses the official MCP SDK, published PKCE/CIMD discovery, fixed trusted HTTPS endpoints, expiring user-bound state consumed atomically, encrypted server-side tokens and a database lease around token refresh. Connect returns in the same tab; status, tool discovery without generation, reconnect and disconnect controls are implemented. No Higgsfield generation is automatic or claimed free; MCP consumes account credits even with Unlimited plans.

## Subscription study and actual vendor boundaries

Read the supplied Notion Rerun study in full. Its useful connection abstraction and private-secret principles informed this original implementation; no AGPL source was copied. Its own private CLI OAuth shortcuts were not adopted.

Official OpenAI documentation says remotely hosted ChatGPT plan usage requires approval, and website identity sign-in needs a provisioned client ID. No approved client ID was in the supplied inventory. Plan access also does not enable image-generation tools on the published preview route. Claude's official documentation does not permit a third-party application to collect/intermediate Claude subscription credentials; ordinary users can sign in to unmodified Claude Code themselves and connect external MCP tools. The supported UI therefore opens the official apps and supplies the OpenPikzels MCP URL/instructions. It does not claim direct in-app subscription sign-in or request subscription tokens.

References:
- https://developers.openai.com/siwc/website
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://code.claude.com/docs/en/legal-and-compliance
- https://higgsfield.ai/creator-hub/help-center/integrations/what-is-higgsfield-mcp
- User study: https://app.notion.com/p/4113935b82a681fa9be1cc78500eb62e

## Verification

77 unit/database/route/protocol cases,26 browser cases,production build/TypeScript,3-sample root lab,review feedback gate and6 Lighthouse runs passed. After enabling email codes in isolated consent, TypeScript/build and all26 browser cases passed again. Local Lighthouse representative mobile98/desktop100; mobile LCP2381ms,TBT79ms,CLS0.001;desktop LCP522ms,TBT0,CLS0. Same budgets. Fresh phone email-code and provider/onboarding captures were inspected. Impeccable changed-target scan returned no findings. Fixtures are explicitly separate from real mail delivery and hosted RLS verification. No paid provider smoke or Higgsfield generation has run.

## Approval/security history in this task

Two Supabase connector confirmations expired without execution. The user explicitly asked to reopen the request; a read-only state check preceded one reissue, which succeeded. Hosted policy readback confirmed own-user policies for jobs and both new connection tables.

Automatic review rejected revealing/exporting all project API keys as broader than needed; that command did not execute and was not repeated. A safer normal email-sign-in path was used instead. Automatic review also rejected embedding one-time email codes in command arguments because they would enter the transcript; no code verification ran. That path was stopped. Secure browser authentication is the permitted remaining live sign-in path; no command/code workaround is included. Secrets are omitted throughout these reports.

Live authenticated provider responses, full real-account Allow/refresh/revoke and actual Higgsfield account consent remain to be verified after deployment and secure sign-in. Source/fixtures are not represented as successful live provider tests. Vendor approval remains a separate prerequisite for any direct hosted ChatGPT-plan integration; Claude subscription-token collection is not offered.
