# OpenPikzels — Delight motion

## Thesis

Saving should feel like the last pixel clicking into place. The Operate surface stays quick and readable; a completed draft earns one small red signature, while pointer-driven panels explain their spatial relationship.

## Motion system

| Moment | Purpose / frequency | Recipe |
| --- | --- | --- |
| Successful draft save | Feedback; occasional completion | Four6px red pixels travel2px into a finished tile, opacity.35→1,200ms cubic-bezier(.23,1,.32,1),20ms stagger,260ms total. Label changes immediately to Draft saved; acknowledgment resets after2800ms. No delay before writing, showing results or accepting another action. |
| Compact navigation | Spatial continuity; pointer/touch only | Transform220ms arrival,160ms exit, same cubic easing. Existing inert/focus behavior takes effect immediately. CSS transitions retarget without a queue. Desktop layout remains immediate. |
| Advanced controls | State indication; pointer/touch only | Opacity.6→1 and translateY(-3px)→0 over160ms with shared easing. Keyboard activation has no entrance animation. |

Reduced motion removes spatial movement. The save mark and pointer controls retain only a100ms opacity confirmation; the drawer is immediate. The accessible button name includes the visible Draft saved label and the next action, Save draft again; a polite status announces success. The icon is decorative. No sound, confetti, new media, runtime library or looping effect is added.

The acknowledgment runs only after the real save and library reload succeed. Failure never triggers it. Its fingerprint binds it to the saved inputs, so later edits clear it and changes during an in-flight save cannot acknowledge a different draft. Navigating history, reloading or choosing New creation does not replay it. A new real save may acknowledge again, with only one receipt and one cleanup timer.

## Deliberate exclusions

- Mode switching, keyboard navigation and focus jumps remain immediate: frequent actions should not accrue animation latency.
- Score numerals, pillar evidence, comparison candidates and thumbnail content stay still: they are material for reading and judging.
- The dotted background remains static. Existing brand takes remain finite, with no Play/Pause controls and no video for reduced-motion/data-saving visitors.
- No paid-generation celebration is added: actual provider completion has not yet been verified live, and saving a local concept must never imply an image was rendered.

## Verification

`tests/browser/delight.spec.ts` exercises failed/successful saves, repeated saves, clearing on edits, no receipt replay after reload, real260ms pixel keyframes, drawer pointer/keyboard timing, controls interruption,320px reduced-motion behavior and absence of video sources. Real local IndexedDB saves and explicit error recovery are used; no provider request is made.

Actual390/1440 captures at a frozen100ms point and settled state,320px reduced-motion capture and the mobile drawer were opened for visual review. The feedback stays in the existing footer; the rest of the layout stays steady. The final full suite and performance results are recorded in VALIDATION.md/PERFORMANCE.md and JSON reports. Native Safari/iPhone, real assistive technology and hosted AI/OAuth Allow remain unverified. This is a targeted motion refinement, ready for a final Polish pass.
