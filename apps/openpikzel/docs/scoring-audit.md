# Scoring audit: decision models and "score always finishes"

16 Nov 2026, branch `op/score-always`. Judged against TypeSafe's guidance ([agent skill](https://docs.typesafe.ai/agent-skill), [primitives](https://docs.typesafe.ai/primitives), [state](https://docs.typesafe.ai/concepts/state), [patterns](https://docs.typesafe.ai/patterns)), the community rules Derrick shared, and OpenAI's [Decisions API](https://developers.openai.com/api/docs/guides/decisions) (`POST /v1/decisions`, model `gpt-6-luna`).

## Why scores didn't finish

PR #72 put one yes/no flag question (a Noul) per review flag into the Jev request. Jev answers a Noul with `{type:"noul", noul}`. `parseScores` still required `score` and `confidence` on every answer, so zod threw on every real reply and the studio showed "Score did not finish". The tests' fake Jev replies had only pillar answers, so nothing caught it.

Fix: `parseScores` reads the five pillars only and ignores everything else; a broken pillar is "not assessed" instead of failing the score. `tests/fixtures/jev-reply.ts` now builds replies in the documented shape (Score answers with `probabilities` and `legend`, Nouls with `noul`, plus `model` and `usage`).

## Fallbacks (approved 16 Nov)

The numbers come from the first connected scorer that answers, in this order (`src/lib/scorers.ts`):

1. Jev (TypeSafe decision model)
2. OpenAI Decisions API, `gpt-6-luna` (OpenAI's decision model)
3. The image reviewer the user picked (Claude, or Gemini), answering the same rubric
4. Any other connected key

With scorer = "model" in Settings, the reviewer goes first. At most three scorers are tried per request (job budget 3, or 4 with the image review). Only if all fail does the score fail, and the error names each reason.

The image review (written advice) is not part of the fallback: it stays on the one provider the user chose. If it fails, the score still finishes and shows the existing "Image review did not finish" note.

A fallback score says so in one quiet line: "Scored by OpenAI · Jev didn't answer". The route is stored on the score (`scoring.route`) and in `contributors`.

## Retry

A score that failed for certain (every scorer refused, or our own save failed after they answered) now ends as `failed` and the response says `jobState: "failed"`. The studio then sends a fresh request ID on "Retry score". A lost connection still keeps the same ID and stays `reconciling`, so a score that did finish is replayed, never paid twice. Nothing retries on its own.

## No title

Idea and Curiosity are judged against the title, else the thumbnail's intended promise (planned concept and on-image text), else the image alone. Every image gets an overall number. No UI note is shown. The title-only flags (`text_repeats_title`, `depends_on_title`) are not asked when there is no title. One-Click Fix no longer requires a title.

## TypeSafe rules, one by one

| Rule | Before | Now |
|---|---|---|
| State holds only facts that change the call | State carried `visualGuidance` (the reviewer's prose), the title under a generic key, and a style line mixed into the brief | `state` is `thumbnail`, `phonePreview`, `videoTitle`, `intendedPromise`, `videoFacts`, each only when present. Reviewer prose removed: it made the decision depend on another model's wording |
| Screen user text for injection | None | One yes/no question, batched in the same request (a separate call only pays off before a costlier step, per TypeSafe's Noul-screen pattern). Its probability is stored as `scoring.injection` for review |
| Atomic, literal questions; descriptive criteria | Already true: 5 Scores with 4 described levels plus examples, one Noul per flag with explicit yes/no descriptions | Kept. The same questions go to OpenAI Decisions (score levels with labels and examples; predicates with yes/no wording) |
| Never ask for explanations | True for Jev | Kept. The LLM fallback returns only a level per pillar |
| Build options in code | True: fixed level lists and flag vocabulary | Kept |
| Batch every independent question | True | Kept, including the injection screen |
| Code owns thresholds and arithmetic | Flag threshold 0.5 in code; penalties in code; but the reviewer's guesses about word counts and "logo present" were taken as-is | `src/lib/flag-policy.ts`: words on the image are counted in code (> 4 sets `too_many_words`); title-only flags drop without a title; `invented_numbers` needs some facts to check against; a persona, references or the creator's own upload authorize faces and marks |
| Flags counted only when the review ran | Jev's flag answers were paid for and then ignored if the review failed | A decision model's flags count on their own |
| Gate on confidence | Pillar confidence stored, gating nothing | Recorded per pillar with full `probabilities`. Not gating yet (see below) |
| Log model, distributions, route, outcome | Model id and probabilities discarded | Stored on the score: `jev.model`, `scoring.model`, `scoring.route`, `scoring.flagProbabilities`, pillar `probabilities`. One `openpikzels.score` log line per score (no image, title or key) |

## Deliberate choices, not changed

- **Flag threshold stays 0.5.** The ">0.9 / <0.1" bands need labelled examples to tune; with no data yet, moving them would silently change scores. The probabilities are now stored, so the bands can be tuned from real data.
- **Confidence doesn't gate the score.** A low-confidence pillar still counts; the panel already labels confidence high/medium/low. Routing low-confidence cases to a second scorer was left open.
- **Images stay in the request body.** Jev marks image input "dreamer-ready"; we keep the `TypeSafe-Danger-Zone-Images` header and report Jev's own model id with each score.

## Not verified

No paid call was made. The OpenAI Decisions request was built from OpenAI's guide and the `openai@7.53.0` SDK types, and tested against a fake in that documented shape, not against the live API.
