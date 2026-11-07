# Mobile image correction and measured performance

User screenshot: IMG_9018.png, message Sentinel_a2699d31c5988191bc540f4819e33263. The image was retrieved and visually inspected. The old fixed76px mobile frame used cover cropping: at430px the red plane had only10px below it, leaving its darker front face/shadow crowded against the border.

| Before | After | Evidence |
| --- | --- | --- |
| Fixed76px strip | Reserved3:1 mobile frame, shared still/video alignment | 430px bottom margin10→38px; whole tile/face/shadow visible |
| Late client-only poster, full1344px download | Poster in initial HTML, high priority, responsive672/960/1344px sources | Signal26.3KB→5.1KB on the measured phone profile |
| Layout-fit checks alone | Red-subject margin regression plus actual still/motion/settled captures opened for review | 320,375,390,414,430px; desktop1280/1440 |

`evidence/mobile-art-review-contact.jpg` shows the actual five still and five moving renders. Full-resolution captures and before430 are retained separately. Reduced motion attaches no video sources; playback remains finite with no controls or loop. A focusable skip link and real aria-busy state improve keyboard/status feedback.

## Reproduce

`npm ci --ignore-scripts` then `npm run verify:release`. Uses a production Next build, never the dev server. The tool resolves Chrome from CHROME_PATH or the known local Playwright headless shell; set CHROME_PATH on another machine. No paid tools, remote report upload, new secrets or accounts. Dev-only testing packages are pinned: @lhci/cli0.16.0 and web-vitals6.2.3.

The gate runs sequentially to avoid measuring alongside other browser tests: functional suite → isolated3-sample mobile lab → stdlib Python checker → Lighthouse3mobile +3desktop. `lighthouserc.cjs` names hard limits: LCP2500ms, CLS0.1, TBT200ms, performance0.90, accessibility0.95, best-practices0.90, SEO0.95; script300000B, CSS100000B, image500000B, total1500000B and third-party0 for this local unconnected route. Assertions use median-run. Limits were not relaxed after a failing baseline. No hosted workflow/required branch check was activated.

## Results — final production build

| Lighthouse median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |98|100|
| Accessibility |100|100|
| Best practices |100|100|
| SEO |100|100|
| LCP |2386ms|522ms|
| TBT |66ms|0ms|
| CLS |0.001|0|
| Total transferred, including overhead |261081B|264061B|

The original3-run mobile baseline failed LCP at2561ms. Final mobile passes at2386ms; the poster is discovered earlier and is smaller. Raw reports: `evidence/lighthouse/before-mobile`, `mobile`, `desktop`. Machine-readable final summary: `evidence/performance-lighthouse-summary.json`. The representative run is chosen by LHCI’s median-run method, not an invented average.

The independent Playwright/CDP lab uses390×844, CPU4×,150ms latency,1.6Mbps down/0.75up, three fresh contexts. It uses the official bundled web-vitals observer and actual scripted interactions. Median LCP688ms, CLS0.001, scripted INP64ms; worst click-to-two-frame feedback47.9ms. Initial encoded-body resources: JS217150B, CSS8872B, poster5098B, total255393B, third-party0. The byte accounting differs from Lighthouse transfer sizes because it excludes protocol overhead. `evidence/performance-lab.json` retains each actual sample. `scripts/check_perf_budget.py` rejects absent, non-finite and out-of-budget metrics. It is original code; the external checker was unavailable.

## Guidance inspected and applied

- [Frontend Lighthouse](https://github.com/templatesgrokbot/templatesgrokbot.com/blob/f86a05535cc7a51e10ff2a34e6e783673294e0c4/jobs/it-and-development/coding/frontend-lighthouse.md): production builds, named limits, three runs, median-run gating.
- [KlickerUZH performance patterns](https://github.com/uzh-bf/klicker-uzh/blob/5b8efe36cd3f38da978e64b090e0bc157df34153/.agents/skills/playwright-best-practices/testing-patterns/performance-testing.md): browser/resource timing and isolated budget fixtures; used current INP rather than copying its older FID example.
- [Steve Kinney performance budgets](https://stevekinney.com/courses/enterprise-ui/performance-budgets): distinguish controlled lab, asset limits and real-user field metrics.
- [Web Quality Auditor](https://github.com/danilonovaisv/PORTFOLIO-DANILO-FINAL/blob/546710c1a8057df932563bb3f6c71c43980e3862/.agents/.archive/web_quality_auditor.md): identify the actual LCP element, inspect rendered mobile UI and use byte caps; do not treat a score as a conformance certificate.
- [Pixelslop heuristics](https://github.com/gabelul/pixelslop/blob/main/dist/skill/resources/heuristics.md): inspected the document identified through pixelslop0.3.8 metadata; applied labels, visible state, keyboard escape/skip and actual browser evidence. Its package/scanner was not executed.
- [Nielsen response limits](https://www.nngroup.com/articles/response-times-3-important-limits/): immediate local feedback and truthful status for longer tasks.
- [Doherty reference](https://github.com/aiocean/claude-plugins/blob/f19dc9e07245bc5b6bcd8158bf26f67a7d69d310/plugins/aio-design-system/skills/aio-uiux/references/07-ux-laws/06-doherty-threshold.md): measured local feedback; no invented progress or optimistic paid-job success.
- The supplied `vasilyu1983/AI-Agents-public` URL returned404; repository/owner searches did not find check_perf_budget.py. No claim of reading or running that script. A small original audited checker covers this app’s report format instead.

## Limits

These results describe this local production build’s unauthenticated studio route. They are not field p75, real-iPhone hardware, authenticated cloud-library load or API generation/scoring latency. Native WebKit could not launch due missing system libraries after Playwright’s unsupported-OS fallback; Safari remains unverified. Protected Vercel previews require normal authentication; no bypass URL was created. The public domain connection is complete, but existing authenticated-provider/OAuth/multiuser release gates remain in RELEASE.md. No provider credits, DNS, environment keys or hosted access policies changed for this correction.
