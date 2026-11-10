# OpenPikzels — Delight motion

## Thesis

Saving should feel like the last pixel clicking into place. The Operate surface stays quick and readable; a completed draft earns one small red signature, while pointer-driven panels explain their spatial relationship.

## Motion system

| Moment | Purpose / frequency | Recipe |
| --- | --- | --- |
| Successful draft save | Feedback; occasional completion | Four6px red pixels travel2px into a finished tile, opacity.35→1,200ms cubic-bezier(.23,1,.32,1),20ms stagger,260ms total. Label changes immediately to Draft saved; acknowledgment resets after2800ms. No delay before writing, showing results or accepting another action. |
| Compact navigation | Spatial continuity; pointer/touch only | Transform220ms arrival,160ms exit, same cubic easing. Existing inert/focus behavior takes effect immediately. CSS transitions retarget without a queue. Desktop layout remains immediate. |
| Advanced controls | State indication; pointer/touch only | Opacity.6→1 and translateY(-3px)→0 over160ms with shared easing. Keyboard activation has no entrance animation. |
| New score (OP-11, exception 2) | Feedback; once per creation + score | Overall number counts 0→N over 600ms with `--ease-out-count` `cubic-bezier(.33,1,.68,1)` (gentler than the global `--ease-out`, so the number never idles just short of the score; the JS count solves the same curve), tabular numerals padded to the final digit count so "/100" never moves. Pillar bars fill with `transform: scaleX(0→1)` over 400ms on the same curve, 50ms stagger by pillar position; the 5th bar lands with the number at 600ms. Plays only when the score arrives while that creation is open; a score already there when the creation is opened or the app loads is shown still. Plays once per result (creation id + score timestamp, remembered on this device, as a guard against replay on reload), never on revisit, reload or re-render; an explicit analysis plays it in the analysis dialog and the panel then stays still. "Partial", "Not assessed" and reduced motion show final values at once. Ticks are `aria-hidden`; the accessible text holds only the final value. A polite live region (the panel's, or the analysis dialog's own while that modal is open, never both) announces the final value once per reveal, including under reduced motion; still views announce nothing. |

Reduced motion removes spatial movement. The save mark and pointer controls retain only a100ms opacity confirmation; the drawer is immediate. The accessible button name includes the visible Draft saved label and the next action, Save draft again; a polite status announces success. The icon is decorative. No sound, confetti, new media, runtime library or looping effect is added, except the finite empty-state typing (max 3 cycles) approved below.

The acknowledgment runs only after the real save and library reload succeed. Failure never triggers it. Its fingerprint binds it to the saved inputs, so later edits clear it and changes during an in-flight save cannot acknowledge a different draft. Navigating history, reloading or choosing New creation does not replay it. A new real save may acknowledge again, with only one receipt and one cleanup timer.

## Approved exceptions (2026-11-10, Derrick)

Spec decision F approves exactly these three exceptions. Nothing else in this list is approved. CSS only; no new runtime library. All three respect `prefers-reduced-motion`.

1. **Reveal.** When the real image loads, it goes from blur 12px / scale 1.02 / opacity 0 to sharp in about 450 ms. Batch cards stagger 70 ms apart. Reduced motion: a 120 ms opacity fade only.
2. **Score count-up.** The overall number counts 0 → N in about 700 ms, and pillar bars fill with a 50 ms stagger. It plays once per creation id, never on revisits. "Partial" and "Not assessed" do not animate. Reduced motion: the final numbers appear at once. Screen readers get the final value only (`aria-live` receives the end number, not the ticks).
3. **Living empty state.** While the prompt is empty and unfocused, the placeholder types 3-4 example prompts (about 35 ms per character, 2.5 s hold) over a fanned stack of 3 brand thumbnails. It stops after 3 cycles, on focus, on typing, when the tab is hidden, and once the user has creations. Reduced motion: one static example and a static stack.

**Not approved:** hover glow, card lift and the spinning busy border. Do not add them.

Exception 2 (score count-up) is implemented (OP-11, see the motion system table). Exceptions 1 and 3 are not implemented yet.

## Deliberate exclusions

- Mode switching, keyboard navigation and focus jumps remain immediate: frequent actions should not accrue animation latency.
- Score numerals, pillar evidence, comparison candidates and thumbnail content stay still except the one-time count-up on first score: they are material for reading and judging.
- The dotted background remains static. Existing brand takes remain finite, with no Play/Pause controls and no video for reduced-motion/data-saving visitors.
- No paid-generation celebration is added: actual provider completion has not yet been verified live, and saving a local concept must never imply an image was rendered. The approved blur-to-sharp reveal is not a celebration: it is tied to the real image load and never plays for a saved concept or a failed request.
- No looping effect, except the finite empty-state typing, max 3 cycles.

## Verification

`tests/browser/delight.spec.ts` exercises failed/successful saves, repeated saves, clearing on edits, no receipt replay after reload, real260ms pixel keyframes, drawer pointer/keyboard timing, controls interruption,320px reduced-motion behavior and absence of video sources. For the score count-up it checks the tick sequence, staggered fill timing, final-only accessible text, no replay after reload or revisit, a result arriving mid-count, reduced motion, 0/100/partial scores and long labels; `workspace-races.spec.ts` covers the analysis dialog hand-off, and `tests/score-count.test.ts` the timing, dropped frames and run-once guard. Real local IndexedDB saves and explicit error recovery are used; no provider request is made.

Actual390/1440 captures at a frozen100ms point and settled state,320px reduced-motion capture and the mobile drawer were opened for visual review. The feedback stays in the existing footer; the rest of the layout stays steady. The final full suite and performance results are recorded in VALIDATION.md/PERFORMANCE.md and JSON reports. Native Safari/iPhone, real assistive technology and hosted AI/OAuth Allow remain unverified. This is a targeted motion refinement, ready for a final Polish pass.
