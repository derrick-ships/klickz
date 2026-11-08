# ChatGPT plan: browser-only connection

Decision: no download, CLI installation or local companion prerequisite in the primary ChatGPT onboarding. User reference: the November 8 recording of Notion's OpenAI-hosted consent popup. The recording visibly shows a separate plan-use permission. Its OAuth client must not be reused.

## Actual status — November 8, 2026

Not activated. Production environment metadata has no hosted OpenAI OAuth client configuration. No provider credentials were read or revealed during this check. The old install path has been removed from welcome and connection onboarding. Existing local-companion source/download remains for backward compatibility, outside that onboarding.

The UI explicitly says browser sign-in is unavailable and awaiting activation. It does not render a fake sign-in button, simulate a grant, or imply that an identity-only login funds AI. No new authentication backend was added in this change.

## Required external access

OpenAI's [quickstart](https://developers.openai.com/siwc/quickstart) distinguishes identity from permission to use a ChatGPT plan. Hosted partner availability is limited. [Request an OAuth client](https://developers.openai.com/siwc/request-client-id) with plan-use access through the [interest form](https://openai.com/form/sign-in-with-chatgpt-interest/).

The [website guide](https://developers.openai.com/siwc/website) requires a registered callback, issued client ID, discovery metadata and the assigned token authentication method. Its example covers identity scopes; the approved hosted plan-use contract must also be confirmed. Do not assume the local dynamic-registration client can accept an arbitrary HTTPS callback.

## Prepared access-request description

OpenPikzels is a free browser-based YouTube thumbnail studio. Users should connect their own ChatGPT plan through OpenAI's consent popup, without downloads, for supported title, concept, thumbnail-analysis and editing-prompt tasks. Image generation uses separately connected provider access. Requested capability: Sign in and ChatGPT plan use for AI requests.

Submission requires the owner's explicit authorization to contact OpenAI. This document is not proof that an application was sent or approved.

## Implementation acceptance criteria after access is issued

1. The user clicks Continue with ChatGPT. Open a popup directly from the click; provide a same-tab path if the browser blocks it.
2. Bind each attempt to the signed-in OpenPikzels owner with expiring state, nonce and PKCE; consume it atomically once.
3. OpenAI owns authentication and consent. No password, OTP or provider token is entered into OpenPikzels chat.
4. The server verifies issuer, audience, signature, nonce and granted plan permissions. Identity-only consent never becomes a plan connection.
5. Encrypt per-user credentials server-side, serialize rotating refreshes across instances, and make disconnect/revocation available. Never expose tokens in browser events, storage or logs.
6. Return through a registered callback. Popup events carry completion status only, validate exact origins, and refresh authoritative connection status. Support COOP, closed popups, denial, expiry, retry and account switching.
7. Route only explicitly supported tasks to the user's plan. Never silently fall back to charged API calls. Show plan usage and limits.
8. Test cancellation, replay, account isolation, refresh races, mobile, keyboard and reduced motion. A fixture success is not a real provider activation.
9. Validate real consent and one permitted request before labeling the connection available.

Proposed callback for registration, not an implemented route: https://openpikzels.com/api/connections/chatgpt/callback.
