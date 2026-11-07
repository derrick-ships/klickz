# Release state — November 7, 2026

## Completed

- Existing private `derrick-ships/klickz` repository, draft PR #2; app is isolated under `apps/openpikzel/`.
- Existing Supabase `app-starter-dev` / `iufiqfvufoecbuakzale`, Free plan, private asset bucket, RLS-protected creations/personas/styles and provider/OAuth tables.
- Hosted migrations: original private-studio migration and `openpikzels_private_accounts_mcp`.
- Vercel project `openpikzel` / `prj_QyWc3SoRUCmGsPRmwx4tm4kVhI9z` on Derrick's established team. All URLs remain protected with Vercel Authentication.
- OpenAI project key (not an admin key) and Jev key copied from the authorized Notion inventory into **encrypted preview-only variables**. Dedicated encryption key is also preview-only. `OWNER_PROVIDER_KEYS=true` permits those two keys only after the exact account passes the existing owner helper. Every other user must supply their own keys.
- Preview AI is enabled. Production AI stays disabled. No paid smoke request, account upgrade or credit purchase has run.

## Public launch remains pending

1. GoDaddy rejected this cloud browser after the supplied account email was entered, displaying “Tu navegador es un poco inusual”. No password/OTP was entered and no sign-in succeeded. Continue in an accepted browser for `derrickserna.ca@gmail.com`; do not retry around the cloud-browser restriction. Domain/DNS changes remain pending the main conversation's live-connection approval.
2. Add `openpikzels.com` and `www.openpikzels.com` to the existing Vercel project. Re-read Vercel's recommended DNS immediately before applying it. Current read-only recommendation: apex A `216.150.1.1` and `216.150.16.1`; www CNAME `d0856857d14c1468.vercel-dns-016.com.`. Preserve unrelated DNS/email records. Existing apex resolves to GoDaddy parking (`76.223.105.230`, `13.248.243.5`), nameservers `ns77/ns78.domaincontrol.com`. No DNS records were changed.
3. Configure production `APP_ORIGIN=https://openpikzels.com`, a dedicated encrypted `STUDIO_ENCRYPTION_KEY`, browser-safe Supabase URL/key, `OWNER_PROVIDER_KEYS=false`, and enable AI only for users' own connected keys. **Do not copy Derrick's OpenAI/Jev keys to production.**
4. Apply `20261107174000_public_studio_release.sql` at the approved release and set `OWNER_GATE=false`. It removes only studio-specific owner restrictions while preserving each row's user ownership and private storage. This release migration has **not** been applied to hosted Supabase.
5. Check Supabase signup/email redirect allowlist for `/connect`, email confirmation, delivery and rate limits. No global Supabase Site URL or existing identity-provider configuration has been changed.
6. Create/promote the production deployment and adjust Vercel protection so OAuth discovery/consent/MCP routes are publicly reachable with app-level user authorization. Do not publish a protection-bypass secret.
7. Verify TLS/domain routing, a full real-client Allow→PKCE→tools→refresh→revoke sequence, and one real provider smoke test within the approved allowance: one Low image, five titles, one OpenAI+Jev image analysis. Check uncertain paid outcomes before retrying.

## Approval-review history

Automatic review rejected a single attempted environment batch because it included provider keys in production, beyond the approved protected preview. A read-only check confirmed nothing from that batch was written. The safer preview-only operation succeeded. Production provider-key transfer remains denied and is not needed for the BYOK public release.

No domain mutation, public deployment, protection bypass, provider purchase, or public OAuth access grant was created. Current blockers are pending sign-in/public-launch authorization and real authenticated verification, not a failed application build.

Latest protected preview: https://openpikzel-pvuedmoi9-derrick-serna-zabarains-projects.vercel.app — deployment `dpl_GAPYe98emUMMb2oH1SVCEsC4Bikj` verified READY, project protection enabled for all URLs. Browser entry verified the Vercel login wall. Source implementation commit: `33895ecb1d2979ff567ad8735e1d84264a67b34f`.
