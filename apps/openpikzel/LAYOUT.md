# OpenPikzels — Impeccable Layout

## Direction

Operate surface: prioritize the creation task, keep the roomy prompt and original graphite/red art. Reading path: mode, prompt, subject/style, references, rendering settings, Generate. Tight spacing joins related controls; 16–32px separates decisions. A 4px token scale documents the rhythm.

The independent layout assessment and an isolated mechanical scan preceded edits. The first scan returned `[]`. The independent review found tablet navigation consumed one third of the workbench, mobile reference controls split unpredictably, and onboarding hid key entry below repeated cards.

## Changes

- Collapse navigation at ≤1024px, preserving the desktop column. The compact drawer protects background interaction, wraps keyboard focus and returns focus on dismissal; content-changing actions move focus to the main region. Closed navigation and the hidden file chooser no longer take keyboard focus.
- Keep Persona/Style together and Add references/Link/Library together in real DOM groups. Phone groups occupy separate rows instead of dangling controls. Model/format/Controls use an explicit grid; below380px the model occupies its own row.
- Key entry precedes provider status in DOM and mobile reading order. Desktop uses form/status columns; compact provider rows retain revocation controls. Agent instructions have more space above the heading than below.
- Bound long selected names, preserve full names in the dialog, normalize dialog rhythm, name shared dialogs from their heading, expose favorite toggle state, and increase touched mobile control areas.

## Rendered verification

| Question | Evidence |
| --- | --- |
| Reading order / squint | Actual320/390/768/1440 editor captures preserve the bright Generate action and composer as primary; navigation supports them. |
| Grouping | Phone subject/style and reference groups remain intact; browser checks all buttons inside each group share a row at320/375/390/430/768/1024/1440. |
| Rhythm | Shared4px spacing scale; toolbar12px row separation on phones; account32px desktop column gap,24px mobile section gap; dialog24px padding. |
| Structure | Tablet drawer frees the full workbench; desktop form/status columns represent different tasks. Source and browser assert form is first. |
| Density | Prompt remains generous, provider statuses become compact rows, empty Personas dialog remains short. |
| Adaptation | Real320–1440 renders, deliberate narrow settings stack, no page overflow. Drawer tests cover390/768/1024; DOM/focus follows visual order.320 CSS px covers reflow equivalent to200% of640px, not native browser zoom. |
| Extremes | Long Spanish prompt and persona fixture, empty dialogs, Escape, Tab wrap, main-content transfer and touch controls checked.3:1 art is retained with real red-subject margin checks at320/375/390/414/430. |

The independent final reviewer identified one focus-transfer gap on navigation content actions; it was corrected with regression coverage. Final layout detector: `[]`, with no unexplained findings. This is a structural layout pass; the remaining audit findings on eager large-library loading and palette consolidation remain separate work. Structure is ready for Impeccable Polish.

## Evidence and limits

`tests/browser/layout.spec.ts`, `accounts.spec.ts` and existing suites; local full-resolution `evidence/layout-*.png`, including long-name fixtures. Signed-in onboarding uses explicit test data and mocked routes. No billable requests are made. Native Safari/iPhone, actual OS browser zoom, live provider quality and real OAuth Allow remain unverified. Existing hosted access restrictions remain in RELEASE.md.

Final release checks and performance measurements are recorded in VALIDATION.md, PERFORMANCE.md and the machine-readable reports. These are controlled local production-build measurements, not field p75 or AI latency.
