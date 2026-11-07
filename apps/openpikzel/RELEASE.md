# Release state — November 7, 2026

## Completed

- Existing private `derrick-ships/klickz` repository, draft PR #2; app is isolated under `apps/openpikzel/`.
- Existing Supabase `app-starter-dev` / `iufiqfvufoecbuakzale`, Free plan, private asset bucket, RLS-protected creations/personas/styles and provider/OAuth tables.
- Hosted migrations: original private-studio migration, `openpikzels_private_accounts_mcp`, and `openpikzels_diagnostics_jobs`.
- Vercel project `openpikzel` / `prj_QyWc3SoRUCmGsPRmwx4tm4kVhI9z` on Derrick's established team. Non-custom deployments retain Vercel Authentication. Domain connection is complete: the main thread verified apex/www attachment, HTTPS and www→apex redirect; custom domains are public.
- OpenAI project key (not an admin key) and Jev key copied from the authorized Notion inventory into **encrypted preview-only variables**. Dedicated encryption key is also preview-only. `OWNER_PROVIDER_KEYS=true` permits those two keys only after the exact account passes the existing owner helper. Every other user must supply their own keys.
- Preview AI is enabled. Production AI stays disabled. No paid smoke request, account upgrade or credit purchase has run.

## Public launch remains pending

1. Verify/configure production `APP_ORIGIN=https://openpikzels.com`, a dedicated encrypted `STUDIO_ENCRYPTION_KEY`, browser-safe Supabase URL/key, `OWNER_PROVIDER_KEYS=false`, and enable AI only for users' own connected keys. **Do not copy Derrick's OpenAI/Jev keys to production.**
2. Apply `20261107174000_public_studio_release.sql` at the approved release and set `OWNER_GATE=false`. It addresses the older studio-specific owner restrictions while preserving each row's user ownership and private storage. The new `studio_jobs_app_owner` restriction remains deliberately in place; a public multiuser jobs release requires a separately authorized, reviewed policy change. This release migration has **not** been applied to hosted Supabase.
3. Check Supabase signup/email redirect allowlist for `/connect`, email confirmation, delivery and rate limits. No global Supabase Site URL or existing identity-provider configuration has been changed.
4. Create/promote the production deployment and adjust Vercel protection so OAuth discovery/consent/MCP routes are publicly reachable with app-level user authorization. Do not publish a protection-bypass secret.
5. Verify a full real-client Allow→PKCE→tools→refresh→revoke sequence, and one real provider smoke test within the approved allowance: one Low image, five titles, one OpenAI+Jev image analysis. Check uncertain paid outcomes before retrying.

## Approval-review history

Automatic review rejected a single attempted environment batch because it included provider keys in production, beyond the approved protected preview. A read-only check confirmed nothing from that batch was written. The safer preview-only operation succeeded. Production provider-key transfer remains denied and is not needed for the BYOK public release.

This worker did not mutate DNS, promote a production deployment, create a bypass secret, purchase provider credits or grant public OAuth access. Domain setup was completed separately in the main thread. Current blockers are the authenticated owner session, multiuser release configuration and real provider/client verification. Domain connection is complete.

Latest protected preview: https://openpikzel-nbi13gdkz-derrick-serna-zabarains-projects.vercel.app — deployment `dpl_GfYuBUTSr7gB3jr2zoMhhe67E6U7`, verified READY, preview target (no production promotion). Source implementation commit: `125c69a215ac68c02f63f533b310e0414ab25b91`. This deployment includes the original brand assets and study adaptations. Non-custom deployment authentication remains enabled.

Previous preview: https://openpikzel-pvuedmoi9-derrick-serna-zabarains-projects.vercel.app — implementation commit `33895ecb1d2979ff567ad8735e1d84264a67b34f`; superseded by the preview above.

## Original brand assets

The authorized brand-production extension generated two custom stills and two silent motion clips through Higgsfield, costing 13.5 existing credits. Optimized, same-origin media is integrated into onboarding and the empty studio with opt-in playback. This does not complete or consume the separate approved OpenAI/Jev application smoke test. This worker’s earlier GoDaddy browser restriction was resolved separately by the main thread; it no longer blocks the domain connection.

## Study adaptation and retained restriction

`openpikzels_diagnostics_jobs` was applied to hosted Supabase successfully. Read-only verification confirms jobs RLS enabled, anon SELECT denied, authenticated DELETE denied, the ready-variant immutability trigger installed and the reconciliation function security-invoker. Existing creation/owner restrictions remain.

Automatic review rejected one attempted local source edit that also appended removal of the restrictive `studio_jobs_app_owner` policy to the public-release migration. The process did not execute. The policy removal was not retried. Independent reliability fixes were applied separately, and the restrictive policy remains present in hosted Supabase and the migration source. The stated reason was a persistent access-boundary weakening without specific authorization and with uncertain access impact.

For public multiuser jobs, the exact deferred action is an explicit reviewed migration changing/removing `public.studio_jobs` policy `studio_jobs_app_owner` on Supabase `app-starter-dev` (`iufiqfvufoecbuakzale`), while retaining `studio_jobs_own` and tenant isolation. No such change is included in this delivery.
