# OpenPikzel

A private YouTube thumbnail studio with a Pikzels-inspired dark interface and red accent, implemented with Next.js, OpenAI, Jev and Supabase.

## V1 features

- **Recreate, Prompt, Analyze, Edit and Title** modes; generate an image from a title or explore five title ideas.
- **Flare 2.6 / Sunburst 2.6**, render quality Low / Medium / High / XL / Max, planning Low / Medium / High, and batch sizes 1 / 2 / 4. Every selector is validated and forwarded to the appropriate real API parameter. Unsupported “Light” is not presented as an invented provider setting.
- **Long-form 16:9 and short-form 9:16** exports, 1280×720 or 720×1280 PNG.
- **Image references** via upload, existing creation library, direct public HTTPS image URL or YouTube link. Imports enforce public-network addressing, pinned DNS resolution, redirect validation, file-size limits and image decoding limits.
- **Personas and styles**, 1–6 reference images each; optional OpenAI vision preparation produces a reusable identity/style brief. Generation uses the saved brief and up to three actual images per selected profile. This is reference-guided consistency, not a claim of trained image-model weights.
- **OpenPikzel Score**, evaluating the actual image and title across Virality, Clarity, Idea, Curiosity and Emotion. OpenAI vision produces concrete observations; Jev receives the actual image and title and returns rubric scores and confidence. Each pillar shows what works, what holds it back, and a specific edit.
- **One-click fix** uses the matching analysis, applies improvements with OpenAI image editing, saves a new creation and preserves the original. Changing the title invalidates a previously matching critique and triggers a fresh analysis.
- **Instant resize** preserves all original content on a softly extended/blurred background. This is deterministic image processing and incurs no AI-provider call; it also works locally.
- **Private library**, favorites, search, history, editable concept drafts and image downloads. Local data persists in IndexedDB. Local and cloud libraries do not automatically synchronize.

## Run and validate

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:browser
```

The app runs at http://localhost:3000. No environment file is needed for local references, drafts and instant resize. AI functions fail explicitly if disconnected; no fabricated generations or scores are shown.

## Cloud resources

Vercel project: `openpikzel`, ID `prj_QyWc3SoRUCmGsPRmwx4tm4kVhI9z`, under Derrick’s established team. All deployment URLs are protected by Vercel Authentication. No protection-bypass secret or external access grant is created.

Supabase: existing `app-starter-dev`, ref `iufiqfvufoecbuakzale`. Migration `openpikzel_v1_private_studio` adds `studio_creations`, `studio_personas`, `studio_styles`, private bucket `studio-assets`, owner-folder policies, replay/batch uniqueness and restrictive policies honoring the existing `public.app_web_access()` gate. Existing private owner and OAuth allowlists are retained unchanged. No service-role key is needed. Hosted transaction assertions verified that the owner can insert/read and another authenticated identity cannot read; verification rows were rolled back.

Provider credentials must be supplied through an approved secure environment-variable handoff. They are never stored in this source, its archives, browser bundles or logs. `AI_ENABLED=false` keeps provider calls disabled until activation is approved. Model eligibility, provider balances and real paid outputs have not been verified by mocked tests.

## Reliability and limits

A whole batch is reserved atomically before concurrent rendering. The same user/request identifier cannot be rendered twice. Successful variations survive partial failures; failed rows remain visible and are not automatically retried. The browser preserves a request identifier after an ambiguous network error to prevent accidental duplicate submissions. Long-running provider calls can still be interrupted by hosting limits; inspect history before submitting new work.

Jev image support is experimental. Scores are AI rubric assessments, not measured CTR, empirical conversion forecasts, analytics or guarantees of views. Actual performance should be tested with YouTube Test & Compare. Identity and text fidelity vary with the image model; no fine-tuned persona training pipeline is claimed.

Supabase’s existing owner account signs in with the project’s existing credentials. This version does not create accounts, invite users, reset passwords, purchase credits or change billing plans.

## Design skills installed

Impeccable is pinned as a Git submodule under `vendor/impeccable` and linked for Claude and Cursor. Emil Kowalski’s skills are installed locally for Codex. Hallmark is installed globally for Codex. The user’s explicit Pikzels/red design direction takes precedence over optional theme suggestions. See `INSTALLATIONS.md` for source revisions and commands. Design checks and desktop/mobile screenshots live in `evidence/`.

## Sources

[Pikzels app](https://app.pikzels.com/) and [Analyze feature](https://pikzels.com/features/analyze-thumbnail) informed the user-requested layout and feature set. OpenPikzel uses its own code and brand.

[OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation) defines Sunburst/Flare, quality and planning controls. [TypeSafe image inputs](https://docs.typesafe.ai/images) and [score rubrics](https://docs.typesafe.ai/primitives/score) define the Jev scoring contract. [Vercel deployment protection](https://vercel.com/docs/deployment-protection) documents all-URL authentication. [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) documents private asset access.
