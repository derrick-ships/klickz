# OpenPikzel V1 validation

November 7, 2026. `npm run verify` passed: TypeScript, **28 unit/PostgreSQL/route tests**, production build and **4 real-browser tests**.

Browser checks cover all five modes, real persona picture persistence, model/quality/format/batch controls, local draft reloads, actual 720×1280 PNG output from instant resize, safe disconnected-AI behavior, SSRF boundary rejection, mobile overflow, and 44px mobile model/format/tab targets. Screenshots: `evidence/openpikzel-desktop.png`, `openpikzel-mobile.png`, `openpikzel-laptop.png`.

Provider tests use mocked HTTP, not the user’s credits. They verify official OpenAI generation/edit endpoint choice, Sunburst/Flare selection, quality/complexity/format forwarding, actual image assets and five questions sent to Jev, reference identity preparation, batch reservation, duplicate request rejection, partial failures and fix instructions. No paid live provider response has been claimed.

Hallmark’s actual render audit completed at 1280×800, 1440×900, 1920×1080 and mobile widths. Latest receipt: zero FAIL, zero open REFLEX, zero WARN. Compact spacing is explicitly waived to retain the user-pinned editor reference. An independent finish review requested higher field-edge contrast, legible mobile labels and larger touch targets; these were applied and the final browser measurements passed. Impeccable detector output was an empty finding list.

## Hosted database checks completed

Migration `openpikzel_v1_private_studio` was applied to the existing `app-starter-dev` project. All three studio tables have RLS. The `studio-assets` bucket is private and limited to 5 MB per upload. `anon` cannot read the creations table. Restrictive policies call the existing `app_web_access()` owner gate.

A transaction inserted a synthetic verification row as the existing owner, asserted it was readable, switched to another authenticated identity and asserted it was invisible, then rolled back. Both assertions passed. No test images or verification records were left in hosted storage. Existing `notes`, owner allowlist and OAuth allowlist were retained.

The pre-existing advisor notices about the intentional owner helper functions and disabled leaked-password checking remain unchanged. No new studio-table RLS advisory was introduced. No unrelated account settings were changed.

## Deployment and activation boundaries

Vercel project `openpikzel` was created under the established Derrick team with Vercel Authentication for **all** deployments. Existing Supabase project URL and browser-safe publishable key were configured. No service-role key, bypass token, new OAuth client, membership grant, password, billing upgrade or credit purchase was created.

OpenAI and Jev secret handoff and paid smoke tests remain separate activation operations requiring explicit credential-transfer confirmation. The preview is prepared with `AI_ENABLED=false` until that step is approved. The project source contains no live secrets.
