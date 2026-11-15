# OpenPikzels redesign plan — one conversation, scored on arrival

14 Nov 2026. Inputs: Derrick's QA of Mittalmar and Thumbnail Bench (PDF, 14 Nov), Pikzels screenshots, and the current OpenPikzels code (main after PR #61). Plan only; nothing in this file is built yet.

## The problem in one paragraph

Today OpenPikzels has two separate places to work: a **composer** (form + Create button) and a **Creative chat** (a collapsed panel below it that talks to a text model and can only *propose* actions). The image arrives in one place, the score in another panel further down, and the fix behind a dialog. Pikzels does it as one thread: your message, the image with its score badge already on it, the next action. That is the model to beat. Separately, the Creative chat bills an **API key**, never the ChatGPT plan, because the only plan connection we have today reads usage/models and has no inference path.

## What the competitors teach (from the QA)

| Lesson | Source | What we do |
|---|---|---|
| Words on the image are the product. Mittalmar silently drops them; Bench has a separate "Words on it" box and gets 4.5/5. | QA §3, §6, Best features #1 | A **Words on it** field, always sent as exact text, checked by the score. |
| Price on the button, balance on screen. | Bench, Best features #3 | Keep "~$0.03 + score" on the button; show plan/API source next to it. |
| Free review with a named flaw and a Fix it next to it beats "95/100". | Bench §4, Mittalmar §9 | Score shows **the one thing holding it back** first, with a Fix button beside it, not five equal bars. |
| Feed preview with your real channel, 4 sizes, squint. | Mittalmar §9 (best screen) | Our live feed tests already exist; add the channel's own recent thumbnails beside it (YouTube key) and the 4 sizes. |
| A score that rewards an empty or covered headline is a lie. | Mittalmar §9 | Score must fail "headline readable" when Words on it is set and the image doesn't contain it, and be N/A when no words were asked. |
| Cancelling must never erase the brief. Remix must not put the edit instruction in the wrong box. | Bench §5, §6 (worst features #4, #5) | Every message stays in the thread; nothing is a mode that can be cancelled away. |
| Don't invent a face. | Bench contras | No face unless a persona is chosen or the prompt asks for a person; persona = identity contract (shipped in #61). |
| Honest errors with the real reason, no fake "budget reached". | Mittalmar §5 | Already started (#61 image-review reasons); extend to every failure in the thread. |
| Truncation everywhere (styles, review, helper text). | Bench | Thread messages wrap; no fixed-width rows. Tested at 320 px. |

## The new shape: one thread

```
┌ Sidebar: chats (projects) ─┐┌──────────── Thread ─────────────────────────────┐
│ + New chat                 ││ You: "Revisé las cuentas… ¿quién aprobó esos…" │
│ Chats…                     ││      Words on it: ¿QUIÉN APROBÓ ESOS PAGOS?     │
│                            ││                                                │
│ Personas · Styles          ││ ┌ image ─────────────────────── [72] ┐         │
│                            ││ │                                   │         │
│                            ││ └───────────────────────────────────┘         │
│                            ││ Holding it back: the headline is small at      │
│                            ││ phone size.  [Fix it]  [See full score]        │
│                            ││ ⤓ Download   ⋯ More                            │
│                            ││                                                │
│                            ││ You: "make the face bigger"                    │
│                            ││ ┌ image v2 ─────────────────── [81 ▲9] ┐       │
│                            ││ …                                              │
│                            ││┌ Composer (sticky bottom) ────────────────────┐│
│                            │││ Describe it, or tell me what to change…      ││
│                            │││ Words on it: [            ]                  ││
│                            │││ [@Persona] [Style] [+ image] [16:9]  [Create]││
│                            ││└──────────────────────────────────────────────┘│
└────────────────────────────┘└────────────────────────────────────────────────┘
```

- **One composer, bottom-sticky**, like Pikzels and ChatGPT. It replaces both today's composer and the Creative chat box.
- **Every turn renders in the thread**: your message → the image(s) → score badge on the image (count-up, shipped) → "Holding it back" line with **Fix it** → Download / More.
- **What the composer does depends on what you type, not on a tab**:
  - First message, or "make a new one…": **create**.
  - A message while an image is selected ("make the face bigger", "otro fondo"): **fix that image** (edit with the source as first reference; identity preserved).
  - A pasted image or YouTube link with no text: **score it** (the link fills the title, shipped in #59/#60).
  - A question ("¿qué título le pongo?", "¿por qué 72?"): **answer in text** from the text model, with the score and soul.md as context. No image spend.
  The router is a cheap text call that returns `{intent, prompt, words}`; the user always sees which one ran ("Fixing image 2…") and can undo/redo the turn. The Create/Score tabs go away; the loop stays.
- **Click any image in the thread** to select it. The next message applies to it. The selected image shows a ring and "Changes apply to this image".
- **Words on it**: a single optional line under the composer. Sent verbatim to the image model and to the score. Never moved into the prompt.
- **More** on each image: Feed preview tests, Compare with previous, Inspect, Resize to 9:16, Score history, Leave feedback.
- **Sidebar**: chats = projects. Personas and Styles stay at the bottom. Nothing else.

## Subscription-first text model ("the chat should use my ChatGPT plan")

What exists: a ChatGPT device-code connection that reads **usage and models only** (`chatgpt.com/backend-api/wham/usage`, `/codex/models`). It has no inference path, so the chat falls back to an API key.

What OpenAI documents: [Sign in with ChatGPT for plan usage](https://developers.openai.com/siwc/token-sharing-open-source/sign-in): dynamic client registration (`client_id=dynamic_agent_client`), scopes `offline_access resource.invoke chatgpt.tokens.use.direct`, then [Responses API inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) at `api.openai.com/v1/responses` with `store:false, stream:true`. The [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) say **image generation is not supported** on plan tokens, and the documented redirect is a `127.0.0.1` loopback (open-source / local clients). The website flow is identity-only and limited to selected partners.

Plan:
1. **Text in the thread (router, answers, score explanations, prompt writing) uses the ChatGPT plan when connected**, via the plan-usage flow, through the local companion (it already runs on the user's machine and fits the loopback rule). Fallback order is explicit and shown on the button: Plan → OpenAI API key → Google API key. No silent switch.
2. **Images keep using the image key** (OpenAI/Google) or Higgsfield; plan tokens can't generate images (documented).
3. Claude subscription is not an option: Anthropic bans subscription OAuth in third-party apps ([report](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)). Claude stays API-key only.

Risk: plan usage over the web server (not the companion) isn't documented; we won't ship that path without OpenAI partner access.

## Score that arrives with the image

- Auto-score already runs after Create when Jev is connected. Change: the badge is **on the image in the thread**, not in a panel below.
- The first line under the image is **the single biggest fix** (lowest pillar's fix, from the image review), with **Fix it**. Five pillars stay behind "See full score".
- **Words check**: if Words on it was set, the review must say whether the exact words are present and readable at 160 px. If absent → that pillar fails, and Fix it re-renders with the words.
- **Delta on re-score**: v2 shows `81 ▲9` against its parent. This is the loop made visible.

## Phases

| Phase | Ships | Size |
|---|---|---|
| 1. Thread shell | Bottom composer, thread of turns (message, images, score badge, holding-it-back, Fix it), select-an-image, Words on it, Create/Score tabs removed. Old composer and Creative chat removed. | L |
| 2. Router | Intent call (create / fix / score / answer), visible "what ran", undo a turn. MCP gets a matching `send_message` tool so agents use the same loop. | M |
| 3. Score in the loop | Biggest-fix line, words check in the review, score delta, feed preview with channel thumbnails at 4 sizes. | M |
| 4. Plan-powered text | Companion implements Sign in with ChatGPT plan usage; text calls go Plan → API → none, shown on the button. | M, needs a real ChatGPT account test |

Each phase: browser tests updated, 320/390/1440 + 200% zoom, before/after screenshots, CI-gated merge, deploy.

## Anti-goals

- No modes that can be cancelled and lose the brief.
- No second text box that can silently override the first.
- No invented faces, no invented scores (no "95" for an empty headline).
- No silent provider switch.
- No new settings on the first screen. Model/quality stay in More options.

## Decisions needed from Derrick

1. **Router vs. explicit buttons in the thread**: let one text box decide create/fix/score/answer (Pikzels/ChatGPT feel, small risk of guessing wrong, always visible and undoable), or keep small chips above the composer ("New", "Change this one", "Score") with the box below?
2. **Words on it**: separate one-line field (Bench, proven) or detect quoted words inside the message ("put 'SOLO 3' on it")?
3. **ChatGPT plan for text**: OK to require the local companion for plan-powered chat, given OpenAI documents plan usage for local/loopback clients and not for websites?
