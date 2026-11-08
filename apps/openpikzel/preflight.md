# OpenPikzels setup preflight

Date: 2026-11-07, America/Bogota.
Production source reviewed: `2658bfbf4f7967f610473813c92133241e5eaef8`, plus local recovery changes.
Skill: `/home/agent/.agents/skills/preflight-stack/SKILL.md`.

This report lists remaining requirements and failure risks. Completed settings are omitted.
No dashboard action is currently requested from you. Provider-specific consent can still require your private input.
Never paste a secret, email code, or password into chat.

This update reviews local code, existing deployment evidence, and the supplied checklists.
It does not claim a fresh authenticated production test.
The uploaded reference files are guidance. Their example prices, limits, and broad permission suggestions are not verified account requirements.
Your instructions control the format: numbered lists, no tables.
Your existing authorization lets me handle accessible settings. Manual work is limited to unavailable authentication or required consent.

## Scope

1. GitHub: `derrick-ships/klickz`; app directory `apps/openpikzel`; branch `main`. Plan details remain unverified.
2. Vercel: `openpikzel`, under Derrick's existing team. Exact plan and current resource allowances need inspection.
3. Supabase: shared project `app-starter-dev`, ref `iufiqfvufoecbuakzale`. Plan, remaining capacity, and backup entitlement need inspection.
4. GoDaddy: domain registration and renewal for `openpikzels.com`. Renewal settings and registrar recovery remain outside this review.
5. AgentMail: transactional email through the existing sender. Provider sending allowance needs inspection.
6. OpenAI, Jev, and optional Google: each user's API access. Model permissions, balances, and quotas differ by user.
7. Higgsfield: each user's OAuth connection. Its authorization service is operated through Clerk; we do not need a separate Clerk app.
8. MCP clients: ChatGPT, Claude, Cursor, and Codex. Connector access and HTML rendering depend on the host.
9. Notion: private setup inventory. It is not a runtime dependency for ordinary users.

Netlify, Stripe, Resend, Railway, Render, Expo, and a separate Cloudflare account are not current runtime requirements.
No account creation, new personal token, repository transfer, or paid upgrade follows from these references.

## Agent work before calling production complete

2. **Verify email codes and both account types.** Possible · Breaks in prod · Agent · Before launch · Not verified.

   Check configured expiry against the actual form. The live form accepted the new code.
   Check confirmation and magic-link templates.
   Verify the older owner identity and a separate new-user signup. The requested Gmail account now signs in successfully.
   Test return to studio and isolated OAuth consent.
   Preserve the shared project's existing Site URL and unrelated redirects.

   Done when: both accounts reach their own signed-in workspace without repeated sends.
   The existing owner account and the new Gmail signup are different identities.
   Account linking requires an explicit decision; it must not happen silently.

3. **Verify private key storage with real sessions.** Possible · Security hole · Agent · Before launch · Not verified.

   Save each supported provider connection through a secure input.
   Reload and confirm the value is not returned.
   Submit an empty box and confirm the current key is retained.
   Test replacement, removal, and separation between two accounts.
   Verify private persona images, signed URLs, creations, and jobs remain separated.

   Done when: both live accounts pass those checks.
   Preserve the existing encryption key while its ciphertext remains stored.
   Encryption-key recovery and rotation need a documented procedure.
   Production must never fall back to Derrick's provider keys for another user.

4. **Validate the exact OpenAI adapter.** Likely · Blocks build · Agent · Before the bounded AI test · Not verified.

   Check model IDs and request fields against official provider documentation and actual account access.
   The code currently constructs `gpt-image-2.6-${settings.model}`.
   It also sends `complexity` and custom image dimensions.
   The text default is `gpt-5.5`.
   Official OpenAI documentation now confirms the model family, complexity control, quality tiers, and custom dimensions. Actual account access remains unverified.

   Done when: documented request mappings and the authorized low-quality smoke test pass.
   Keep Sunburs and Flare as product labels only if their provider mappings are valid.
   A successful key save alone does not validate a model or endpoint.

5. **Validate Jev scoring against its actual API contract.** Likely · Blocks build · Agent · Before live scoring · Not verified.

   The current adapter calls `https://api.typesafe.ai/v1/systemone` with model `jev-latest`.
   TypeSafe documents this image-asset contract. A separate Jev-hosted API uses `jev-ai.org`; their keys are not assumed interchangeable.
   Confirm the saved key's issuing service before any transmission. Then validate authentication, model access, assets, and response parsing.
   Use the official Jev documentation and the authorized account.
   Confirm five-pillar partial scores and evidence parsing.

   Done when: the real authorized image analysis returns a valid diagnostic.
   A fixture response does not establish provider compatibility.
   The score must not claim CTR prediction or guaranteed uplift.

6. **Complete Higgsfield consent and recovery tests.** Possible · Breaks in prod · Both · Before launch · Not verified.

   Verify branded client metadata, callback URL, PKCE, and consent in a real account.
   Check refresh, expired state, denial, reconnect, and disconnect.
   Discover tools without starting a generation.
   Compare local disconnect with any upstream revocation support.

   Done when: connection and recovery work with that user's account.
   If the provider requires personal consent, stop at its Allow screen.
   A web Unlimited plan does not establish free MCP generation.

7. **Complete authenticated MCP interoperability.** Possible · Security hole · Agent · Before launch · Not verified.

   Test Allow, PKCE exchange, scoped tools, refresh, and revocation against production.
   Verify wrong audiences, reused codes, invalid redirects, and expired tokens fail.
   Test at least one actual remote client.
   Verify HTML in a client supporting MCP Apps.
   Provide a usable tool-only response in other clients.

   Done when: the full lifecycle passes and a revoked token cannot call tools.
   Public registration and Deny checks do not replace these authenticated tests.

8. **Align the automatic deployment settings.** Possible · Breaks in prod · Agent · Before relying on Git pushes · Not verified.

   Inspect **Vercel → openpikzel → Settings → Git**.
   Confirm repository `derrick-ships/klickz` and production branch `main`.
   Confirm root directory `apps/openpikzel` for Git deployments.
   Align the runtime with the tested Node 24.x deployment.
   Project metadata previously reported Node 26.x.
   Check the installed Vercel GitHub App can access this private repository.

   Done when: a Git-backed deployment builds the intended app with the tested settings.
   Current file deployments supply settings explicitly.
   If permissions block an action, request that repository-specific permission.
   No new broad personal token or global workflow write setting is assumed necessary.
   [GitHub's workflow guidance](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) recommends the minimum permissions each workflow requires.

9. **Check upload and response sizes across the complete route.** Possible · Breaks in prod · Agent · Before launch · Not verified.

   Test private browser uploads and MCP uploads near their actual limits.
   Storage allows 5 MiB per supported image.
   MCP base64 input has a separate 2 MB decoded limit.
   Its JSON request limit is 3,500,000 bytes.
   Inspect image response sizes and downloads as well.

   Done when: accepted files complete the path, and oversized files show a useful error.
   [Vercel's function limits](https://vercel.com/docs/functions/limitations) set a 4.5 MB request/response payload ceiling.
   A storage limit does not establish the function's transport limit.
   Use private storage transfers where a function payload would exceed that ceiling.

10. **Verify job recovery and provider costs.** Possible · Costs money · Agent · Before launch · Not verified.

    Test duplicate submissions, concurrent requests, timeouts, reloads, and expired leases.
    Check job state before retrying an uncertain paid request.
    Confirm generation can finish within the deployed function duration.
    Check per-user concurrency and clear failure messages.

    Done when: retries cannot silently duplicate a paid job.
    The authorized smoke remains limited to one Low image, five titles, and one image analysis.
    Do not buy credits or change plans.
    Current duration limits depend on plan and Fluid compute; do not copy the reference's historical 10-second example.

11. **Check actual allowances and commercial hosting eligibility.** Possible · Breaks in prod · Agent · Before launch · Not verified.

    Read the Vercel team's plan and usage.
    Read Supabase database, storage, bandwidth, and auth usage.
    Read AgentMail sending limits.
    Check each provider's balance, model permissions, and quota.
    Check inactivity and renewal requirements.
    Record actual limits before promising free operation.

    Done when: intended use fits the account terms and available resources.
    [Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal, non-commercial use.
    If this project uses Hobby and becomes commercial, identify a permitted hosting path before release.
    Do not purchase an upgrade automatically.
    Treat budget alerts as alerts unless the service documents an enforced cutoff.

12. **Check abuse controls without exhausting sign-in mail.** Possible · Costs money · Agent · Before public launch · Not verified.

    Review signup, OTP, scoring, generation, and OAuth registration rate limits.
    Verify per-user limits cannot charge another user.
    Check validation, request-size limits, safe logging, and account deletion.
    If CAPTCHA is enabled, verify both its server secret and accessible client flow.
    Assess the control before adding a new dependency or dashboard task.

    Done when: ordinary users can sign in, while automated requests cannot consume unrestricted resources.
    RLS protects data access; it does not replace request throttling.

13. **Define backup, monitoring, and rollback ownership.** Possible · Breaks in prod · Agent · Before launch · Not verified.

    Check the current backup entitlement and restore process.
    Include private image storage in recovery planning.
    Preserve the application encryption key through the approved secret channel.
    Check log retention and notifications for failed deploys, quota exhaustion, and auth failures.
    Document a compatible rollback without reversing unrelated migrations.

    Done when: recovery instructions identify a usable release, data recovery path, and responsible recipient.
    Do not create persistent exports, scheduled tasks, or third-party log access without authorization for those actions.

14. **Publish recovery changes and repeat acceptance checks.** Possible · Breaks in prod · Agent · Before declaring completion · Pending.

    Publish the local “I already have a code” recovery change.
    Run the required release checks on the exact source being deployed.
    Inspect desktop, mobile, keyboard access, and reduced motion.
    Confirm the production source and alias match.
    Run generation, scoring, fix, resize, downloads, and persona references with real sessions.
    Send the requested completion email only after reporting all remaining limits accurately.

    Done when: the deployed build passes acceptance, with fixtures separated from live provider results.
    The existing local tests do not establish GitHub CI.
    Add only the workflow permissions required if persistent CI becomes part of the deployment path.

## Conditional vendor requirements

15. **Obtain an approved hosted ChatGPT integration if direct plan access remains required.**
    Likely · Blocks build · Vendor / owner · Before offering that option · Pending.

    Check the official OpenAI client-registration and hosted token-sharing requirements before implementation.
    An approved client was not found in the inventory.
    GitHub and Supabase settings cannot grant this provider approval.
    Existing official Codex/Claude clients can connect through the app's MCP endpoint.
    Do not collect Claude subscription credentials or borrow private client IDs.

16. **Validate Google only for users choosing Google.**
    Possible · Breaks in prod · Agent · Before advertising that provider · Not verified.

    Verify the implemented Gemini model, endpoint, key restrictions, and account quota.
    API-key use does not itself require Google OAuth or a new Google sign-in client.
    If Google identity sign-in is added later, check consent publishing and exact callback URLs.
    Do not ask users to enable unrelated Google APIs.

## If something breaks

1. `over_email_send_rate_limit`: inspect the Supabase project email cap and AgentMail allowance.
2. `otp_expired` or an invalid code: inspect expiry, the latest code, and code-length compatibility.
3. `redirect_uri_mismatch`: compare the exact requested callback with that provider's registered callback.
4. `invalid_api_key`: check the saved connection's provider and project without returning its value.
5. `model_not_found` or an unknown field: check the adapter contract before changing billing.
6. `insufficient_quota`: inspect that user's balance and quota; do not retry indefinitely.
7. `new row violates row-level security policy`: inspect the signed-in identity and own-row policy; keep RLS enabled.
8. `413 FUNCTION_PAYLOAD_TOO_LARGE`: inspect the complete transport path and use private storage transfers.
9. `FUNCTION_INVOCATION_TIMEOUT`: inspect duration, job state, and provider outcome before retrying.
10. `GH013` or integration `403`: inspect the specific branch rule or app permission; preserve repository protection.

## Verification record

1. Installed the original skill with a one-character description correction required by the metadata validator.
2. Installed all 16 uploaded references in their intended folders; byte comparisons passed.
3. Read the writing guide, report template, failure taxonomy, and relevant service checklists.
4. Reviewed the local manifest, configuration examples, provider adapters, asset limits, and deployment notes.
5. Checked current official Supabase email, Vercel hosting/function, and GitHub workflow-permission documentation.
6. Reused earlier hosted evidence with its limitations; no new authenticated checks or paid provider calls ran in this update.

## Latest sign-in verification

1. Derrick reported the Supabase email limit saved at 30 per hour. The numeric setting was not independently read.
2. A fresh sign-in email reached the matching Gmail account. No 429 occurred in this send.
3. The first submitted code failed with `otp_expired`; no code value was logged.
4. At Derrick's request, sent one new code and used private browser verification.
5. The production page then displayed provider connections, connected-agent controls, and Sign out.
6. Authenticated sign-in is verified. Provider keys, paid generation, and Higgsfield consent remain separate checks.
7. The two visible temporary read-only OAuth grants are revoked. Their presence alone does not prove every OAuth lifecycle assertion.

Provider documentation checked: [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation), [TypeSafe images](https://docs.typesafe.ai/images), and [Jev-hosted decisions](https://jev-ai.org/docs/decisions/).

## Local companion prerequisites

1. The local route uses unmodified official CLI login and does not require the hosted OAuth-client approval discussed above.
2. Node 22+, a current official Claude Code/Codex CLI, and the user's own sign-in are required on the user's computer.
3. The cloud development environment cannot establish that these are installed or authenticated on Derrick's Mac.
4. Source-package launcher/login behavior on a real Mac remains unverified. Windows packaging and signed native installers are not included.
5. Text tasks use active CLI limits. Image generation and Jev scoring retain their separate API requirements.
