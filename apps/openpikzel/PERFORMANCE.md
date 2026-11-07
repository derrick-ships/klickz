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

## Results — mobile-correction build (historical baseline)

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

## Layout release — historical baseline

The full release gate passed on the final layout implementation, with the same limits. Three Lighthouse runs per profile and three isolated CDP lab samples were collected again.

| Median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |98|100|
| Accessibility |100|100|
| Best practices |100|100|
| SEO |100|100|
| LCP ms |2374.932|520.655|
| TBT ms |69.500|0.000|
| CLS |0.001|0.000|

Controlled mobile lab medians: script_bytes=217525.000, css_bytes=9345.000, image_bytes=5098.000, total_bytes=256311.000, third_party=0.000, lcp_ms=696.000, cls=0.001, inp_sample_ms=72.000. Maximum click-to-two-frame feedback across all samples: 72.4ms. Lighthouse total transfer: mobile=261999B, desktop=264979B. Native-device and live-provider limitations above still apply.

## Delight motion release — historical baseline

TypeScript,69 unit/database/protocol cases, production build,22 functional browser cases, isolated3-sample lab and6 Lighthouse runs passed on the finished implementation. The same limits remain.

| Median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |99|100|
| Accessibility |100|100|
| Best practices |100|100|
| SEO |100|100|
| LCP ms |1983.552|517.783|
| TBT ms |62.500|0.000|
| CLS |0.001|0.000|

Controlled mobile lab medians: script_bytes=217845.000, css_bytes=9627.000, image_bytes=5098.000, total_bytes=256978.000, third_party=0.000, lcp_ms=680.000, cls=0.001, inp_sample_ms=72.000. Maximum click-to-two-frame feedback: 42.7ms. Lighthouse total transfer: mobile=262666B, desktop=265646B. No runtime dependencies or media were added. These are local lab metrics, not field p75, native-device or provider timings.

## Clarify copy release — historical baseline

The full release gate passed on the final copy revision:69 unit/database/protocol cases,22 browser cases, isolated3-sample lab and6 Lighthouse runs; TypeScript and production build passed. Same budgets, no relaxed threshold.

| Median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |98|100|
| Accessibility |100|100|
| Best practices |100|100|
| SEO |100|100|
| LCP ms |2373.900|519.595|
| TBT ms |67.000|0.000|
| CLS |0.001|0.000|

Controlled mobile lab medians: script_bytes=218297.000, css_bytes=9627.000, image_bytes=5098.000, total_bytes=257431.000, third_party=0.000, lcp_ms=688.000, cls=0.001, inp_sample_ms=64.000. Maximum click-to-two-frame feedback: 51.2ms. Lighthouse total transfer: mobile=263119B, desktop=266099B. Controlled local samples only; no claim of field p75, native-device validation or live provider timing.


## Review Studio / Hallmark release — historical baseline

The selected Review Studio passed the full unchanged release gate: TypeScript,69 unit/database/route/protocol cases, production build,25 functional browser cases, isolated3-sample mobile lab, the new two-viewport review interaction gate and6 Lighthouse runs. No dependencies or media were added.

| Representative median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |97|100|
| Accessibility / Best practices / SEO |100 / 100 / 100|100 / 100 / 100|
| LCP ms |2409.206|531.832|
| TBT ms |102.5|0|
| CLS |0.001|0|
| Total transfer bytes |265912|268892|

Root mobile lab medians: JS219425B, CSS11285B, image5098B, total260223B, third-party0, LCP752ms, CLS0.001, scripted INP88ms. Maximum click-to-two-frame feedback51.4ms. Encoded-body accounting excludes protocol overhead; Lighthouse transfer totals include it.

The explicit saved-image fixture was measured separately under CPU4× with five real Feed preview toggles per viewport. Maximum click-to-two-frame feedback:390px20.2ms,1440px19.5ms. No observed long tasks; sampled RAF median16.7ms on both, maxima16.8ms. These are controlled headless samples, not physical FPS, field p75 or measured INP. The100ms feedback budget passed without relaxing limits. Full metrics/counters: evidence/performance-review.json.

Actual rendered review captures at320/375/390/768/1024/1280/1440/1920,200px feed preview, unscored and failed-preview states were opened for visual review. New tests verify selected actions, partial/null scoring, real refresh, reduced-motion, modal-before-drawer Escape and static keyboard hit areas. Native iPhone/Safari, zoom, assistive technology, live provider and hosted authenticated performance remain unverified. No paid request or hosted-policy change occurred.


## Final Impeccable polish — current verification

The full release gate passed with unchanged limits: TypeScript,69 logic/database/route/protocol tests, production build,25 browser tests,3 mobile lab samples,2-viewport review interaction test and6 Lighthouse runs.

| Representative median-run | Mobile | Desktop |
| --- | --- | --- |
| Performance |98|100|
| Accessibility / Best practices / SEO |100 / 100 / 100|100 / 100 / 100|
| LCP ms |2387.034|515.201|
| TBT ms |68|0|
| CLS |0.001|0|
| Total transfer B |266045|269025|

Root mobile lab median LCP708ms,scripted INP72ms,CLS0.001; initial encoded-body JS219504B,CSS11335B,image5098B,total260355B,third-party0. Maximum local feedback47.5ms. Review preview-toggle maximum feedback20.3ms at390px and22.7ms at1440px under CPU4×, with no observed long tasks. Source and methods remain in the JSON reports. These controlled local results are not field p75, physical-device FPS, hosted performance or provider latency. Native Safari/iPhone remains unverified. No threshold was changed.
