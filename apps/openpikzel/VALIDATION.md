# OpenPikzels validation

November 7, 2026. Final validation covers TypeScript, 50 unit/database/route/protocol tests, a production build and eight Playwright browser tests. Tests make no paid provider requests.

## Verified locally

- Five studio modes, model/quality/intelligence/format/batch settings, real reference uploads and profile persistence, local drafts and downloads, actual 720×1280 PNG output for instant resize, responsive editor and 44px mobile controls.
- OpenAI generation/edit contract, real image/title Jev payload with five rubrics, optional vision observations, Jev-only analysis without an extra provider charge, Google image contract and user-key forwarding, identity briefs, atomic batches, duplicate prevention and partial failures.
- All four source migrations replay in PGlite: per-user row/folder isolation, foreign-key ownership, private buckets, provider ciphertext ownership, and public-release row isolation. The final release migration is intentionally unapplied in hosted Supabase.
- OAuth discovery, DCR redirect restrictions, mandatory S256 PKCE, exact resource audience, code theft prevention, single-use codes, expiration, scopes, refresh rotation/replay and revocation. Consent Origin/cookie protection and state-preserving Deny. Purpose-bound authenticated encryption and concurrent per-request BYOK contexts. Global owner keys never fall back to other users.
- Actual SDK Streamable HTTP initialization, tool discovery, tool invocation, read-only protection and bundled MCP Apps HTML resources. Direct HTTP generation/analyze/prepare/resize routes independently reject AI grants missing write permission.
- Browser HTTP registration→branded consent→Deny flow. Signed-in onboarding fixture verifies provider key entry clears immediately and never enters localStorage; connected-agent revocation controls and mobile layout render. A real iframe host bridge fixture exercises the bundled Apps UI, creation selection, score display, copyable fix prompt and clearing hidden thumbnail selection before resize.

Signed-in onboarding and widget screenshot data are **explicit test fixtures**, not real accounts, real provider scores or live generations. Screenshots include `evidence/openpikzels-provider-onboarding.png`, `openpikzels-provider-onboarding-mobile.png`, `openpikzels-oauth-consent.png`, `openpikzels-mcp-widget.png`, `openpikzels-mcp-widget-mobile.png` and the existing editor captures.

Impeccable, Emil and Hallmark were installed and applied. The original editor's Hallmark rendered audit had zero FAIL/open REFLEX/WARN, with compact spacing waived to follow the user's pinned layout. Independent review of new OAuth/account code found missing direct-route write checks and global sign-out behavior; both were corrected and regression-tested. New widget hidden selection was cleared, and account/consent step labels changed to sentence case without tracking. Real browser captures verify the added screens.

## Verified in hosted services

- Private GitHub PR #2 preserves the existing root thumbnail project.
- Vercel project protection remains enabled for all deployments. OpenAI/Jev variables are encrypted and preview-only; production AI remains disabled. No bypass secret is created.
- Supabase hosted private-studio and private-accounts migrations succeeded. New provider/OAuth tables have RLS, deny anon SELECT and each retain a restrictive owner-preview policy. A rolled-back synthetic key/grant transaction confirmed another authenticated identity cannot see the rows. No test grants or keys persist.
- Read-only Vercel domain inspection confirms openpikzels.com is not attached and DNS still points to GoDaddy parking. The browser reaches GoDaddy sign-in and Supabase dashboard sign-in; no credentials were entered or DNS/account settings changed.

## Not yet verified live

No real OpenAI/Jev/Google response, paid smoke test, real-client OAuth Allow/refresh sequence, production deployment, TLS for the purchased domain, or external Claude/Cursor/Codex connection is claimed. The paid smoke test is authorized but awaits a usable authenticated owner session. Public launch and GoDaddy account access remain pending; see RELEASE.md.

Automatic review rejected a batch that would also have copied owner provider keys to production. A read-only check confirmed no write occurred. The narrower approved preview-only operation succeeded. No owner keys are required in production for the BYOK design.
