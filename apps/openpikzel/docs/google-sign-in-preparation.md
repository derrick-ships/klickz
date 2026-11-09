# Google sign-in preparation (inactive)

Derrick chose: Prepare setup and keep email sign-in for now. No OAuth application, secret or provider setting was created or changed.

The existing hosted Supabase project is iufiqfvufoecbuakzale. Its provider callback is:

https://iufiqfvufoecbuakzale.supabase.co/auth/v1/callback

The verified production studio domains are https://openpikzels.com and https://www.openpikzels.com. Email-link redirects currently return to /connect. Provider requirements and API setup remain separate from Google identity: Google sign-in would not supply a Gemini API key or generation credits.

## Prepared activation steps, awaiting a later explicit request

1. Derrick selects the Google Cloud project and OAuth application. Confirm intended audience and consent-screen publishing status in that project.
2. Review the exact application origins above and register the Supabase callback as an authorized redirect URI for a web application. Preserve unrelated existing origins and redirects.
3. At action time, obtain approval before creating persistent client credentials or storing them. Put the client secret directly into the Google provider configuration in Supabase; never into source, chat, browser storage or a public environment variable.
4. Review the existing Supabase site URL and allowlist before any proposed edits. Do not replace a shared project's redirects. Enable only after the reviewed configuration is approved.
5. Add a Google button to the same account flow, preserving /connect continuation, draft recovery, email fallback, cancel/error handling and owner access rules. Test against an approved test account without altering existing identities.

No enablement or credential action is authorized by this preparation document.

Official setup guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-google (checked 2026-11-09).
