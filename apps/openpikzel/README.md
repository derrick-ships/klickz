# OpenPikzels

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

## Original brand imagery

Higgsfield-generated graphite/red backgrounds and silent motion clips now appear in onboarding and the empty studio. Playback controls were removed as requested. Eligible visitors see one brief ambient take, then a still; reduced-motion/data-saving users load only the poster. Media streams from the same app origin. The complete optimized set, including responsive poster variants, is about 198 KB. See [ASSETS.md](ASSETS.md) for art direction, exact prompts, provenance and the 13.5-credit production record.

## Accounts, BYOK and MCP

`/connect` provides account signup/sign-in, private per-user OpenAI/Google/Jev connections, agent instructions, the MCP URL and connected-agent revocation. Keys are encrypted on the server with user/provider binding. API tools never return keys. Consumer ChatGPT/Gemini subscriptions do not include API credits.

`/mcp` implements Streamable HTTP with OAuth metadata, dynamic client registration, S256 PKCE, branded Allow/Deny consent, exact resource audience binding, single-use codes, rotation and revocation. The same backend powers the browser and agent tools. The bundled MCP Apps HTML studio supports uploaded images, profiles, scoring, generation, fix prompts and resize in compatible clients. See [MCP.md](MCP.md) for setup, tools and copyable instructions.

Jev can score an image created inside ChatGPT without an OpenAI image API call. `get_fix_prompt` returns a copyable edit prompt. Optional OpenAI or Google vision adds concrete visible observations to Jev's five numeric rubrics. Google supports Gemini Flash/Pro image models at native 1K; Sunburst/Flare retain OpenAI quality/intelligence controls.

## Cloud resources and release

The app lives in the existing private `derrick-ships/klickz` repository under `apps/openpikzel/`, draft [PR #2](https://github.com/derrick-ships/klickz/pull/2). The existing Supabase project is `app-starter-dev` / `iufiqfvufoecbuakzale`; creations, profiles, provider ciphertext and OAuth grants have RLS, and `studio-assets` is private. No service-role key is used.

Vercel project `openpikzel` / `prj_QyWc3SoRUCmGsPRmwx4tm4kVhI9z` protects non-custom deployments with Vercel Authentication. The main thread independently verified that `openpikzels.com` and `www` are attached, HTTPS works and www redirects to the apex; custom domains are public. Authorized OpenAI/Jev keys and the server encryption key were configured only for the protected preview. The owner-key fallback is restricted to the exact existing owner account. Other users never receive that fallback. Production AI is disabled and has no provider keys.

Domain connection is complete. **Authenticated app/provider validation and multiuser MCP activation remain pending.** See [RELEASE.md](RELEASE.md) for the remaining account/release gates and approval-review outcome. No paid application-provider smoke test has run yet.

For a fresh local deployment copy `.env.example`, configure the browser-safe Supabase variables and a 32-byte hex `STUDIO_ENCRYPTION_KEY`. Apply the private-studio, settings/batch, private-account and diagnostics/jobs migrations for an owner-restricted preview. The separate public-release migration remains unapplied and does not remove the new restrictive jobs-owner policy; broad access needs an explicit, reviewed release change. Keep the encryption key stable; rotation requires reconnecting encrypted provider keys and agent sessions.

See [STUDY.md](STUDY.md) for the implemented study adaptations: nullable diagnostic pillars, actual 200px previews, signed evidence-based fix plans, immutable variant lineage, blinded human comparison and persistent idempotency jobs.

## Reliability and limits

A whole batch is reserved atomically before concurrent rendering. The same user/request identifier cannot be rendered twice. Successful variations survive partial failures; failed rows remain visible and are not automatically retried. The browser preserves a request identifier after an ambiguous network error to prevent accidental duplicate submissions. Long-running provider calls can still be interrupted by hosting limits; inspect history before submitting new work.

Jev image support is experimental. Scores are AI rubric assessments, not measured CTR, empirical conversion forecasts, analytics or guarantees of views. Actual performance should be tested with YouTube Test & Compare. Identity and text fidelity vary with the image model; no fine-tuned persona training pipeline is claimed.

Users can create their own Supabase account from `/connect` after public release and email configuration. Setup has not created user accounts, invited users, reset passwords, purchased credits or changed billing plans.

## Design skills installed

Impeccable is pinned as a Git submodule under `vendor/impeccable` and linked for Claude and Cursor. Emil Kowalski’s skills are installed locally for Codex. Hallmark is installed globally for Codex. The user’s explicit Pikzels/red design direction takes precedence over optional theme suggestions. See `INSTALLATIONS.md` for source revisions and commands. Design checks and desktop/mobile screenshots live in `evidence/`.

## Sources

[Pikzels app](https://app.pikzels.com/) and [Analyze feature](https://pikzels.com/features/analyze-thumbnail) informed the user-requested layout and feature set. OpenPikzels uses its own code and brand.

[OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation) defines Sunburst/Flare, quality and planning controls. [TypeSafe image inputs](https://docs.typesafe.ai/images) and [score rubrics](https://docs.typesafe.ai/primitives/score) define the Jev scoring contract. [Vercel deployment protection](https://vercel.com/docs/deployment-protection) documents all-URL authentication. [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) documents private asset access.

## Measured release gate

Run `npm run verify:release` for the production build, functional tests, isolated throttled interaction lab, strict Python budget check and three Lighthouse runs each for mobile/desktop. Reports stay local; no hosted analytics or provider calls are needed. PERFORMANCE.md records the measured values, exact sources, mobile crop evidence and limits. These gates are runnable locally; no GitHub branch-protection rule or hosted CI workflow was enabled.
