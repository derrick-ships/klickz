# Easier OpenPikzels sign-in — November 9, 2026

## Shipped behavior

- Normal account sign-in starts with one email field and “Email me a sign-in link.” New and existing users use the same path. This uses the existing Supabase signInWithOtp operation and the existing /connect redirect; it does not add an identity provider.
- Password sign-in and password-based account creation remain available. The same-page code fallback works without sending another email.
- The sent state identifies the recipient, explains the link and code options, and offers change-email and resend recovery. The recipient is read-only while entering a code; changing it clears the old code. Requests disable editing while pending, use an immediate in-flight guard, and respect a local 60-second resend cooldown after success or a server rate-limit response. Server limits remain authoritative.
- Expired or invalid account email callbacks show safe, fixed recovery text. Provider-supplied error text is not reflected, and error parameters are removed from the address bar. Successful implicit callbacks are left to the Supabase SDK. Higgsfield callbacks carrying state are untouched.
- MCP consent still uses a separate nonpersistent session and prioritizes code entry in the consent page. The UI explicitly explains that an email link opens the main studio separately. No access is granted until the existing Allow action.
- The signed-out Connections page focuses on sign-in. ChatGPT provider setup appears after authentication. Existing provider settings, keys, sessions, scopes, database policies, mail templates and redirects were not changed.

## Configuration evidence and boundary

ACTIVATION.md records the existing AgentMail SMTP setup, one-time links plus code templates, canonical redirect configuration, and earlier real sign-in verification. Supabase's official passwordless guide confirms that signInWithOtp sends magic links by default and that the template controls inclusion of the code:
https://supabase.com/docs/guides/auth/auth-email-passwordless

This release uses that existing setup. It did not send a new real authentication email, inspect live private mail, change hosted authentication settings, create credentials, or run a paid provider call. Fresh inbox delivery is unverified in this pass. The earlier denied production-browser path was not retried.

If a live email lacks its link/code or cannot return to /connect, the specific configuration to inspect is the existing Supabase Magic Link template (ConfirmationURL plus Token), canonical /connect redirect allowlist and SMTP delivery status. No evidence in this pass justified changing those settings.

## Validation

The first full Chromium pass ran 99 scenarios: 98 passed; one older form-validation test still expected a password on the default screen. It was updated to validate the new email-first entry without weakening the invalid-email or no-network assertions.

TypeScript, the production build and all 128 unit/database/protocol tests passed before final presentation refinements. Final targeted Chromium, WebKit and performance results are recorded below after completion. Browser authentication responses are fixtures, including the successful SDK magic-link callback; they do not prove live deliverability.

Mobile screenshots are browser emulation, not physical-device tests. Automated accessibility results do not establish a screen-reader pass or completion of the earlier LOOP protocol.

## Final release checks

- Final TypeScript check and production build: passed.
- Unit/database/protocol tests: 128 passed.
- Full Chromium baseline: 98/99 passed initially; the stale password-first validation assertion was updated. Final targeted Chromium: 25/25 passed, covering every changed authentication path plus account loading/errors, provider setup, ChatGPT onboarding and the existing route/accessibility matrices.
- WebKit: 14/14 account and sign-in scenarios passed.
- A final test exposed delayed requestAnimationFrame focus stealing subsequent typing during a mode switch. Focus now moves during the layout commit; exact field values and password failure recovery pass in both engines.
- Automated axe matrix: 21 route/state/breakpoint combinations, zero confirmed violations, 21 incomplete contrast results requiring manual assessment. This is not an assertion of full accessibility compliance.
- Mobile production-build lab: three samples, median LCP 1,344 ms, CLS 0.001, sampled interaction latency 40 ms, maximum feedback latency 30.8 ms, maximum transferred bytes 214,652; existing budget passed. These are controlled local measurements, not field percentiles.
- Actual rendered entry and sent-state screenshots inspected at desktop and 320/390 px. Keyboard focus, 44 px minimum buttons, no horizontal overflow and reduced-motion behavior checked.
- Existing account storage, provider authentication, keys and consent permissions were preserved. The tests do not claim a new live inbox-delivery check or full real-provider OAuth validation.
