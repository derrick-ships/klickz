# OpenPikzels gestures — 2026-11-08

1. Before/after comparison now maps the pointer to the full image instead of the browser range thumb's narrower track. Tracking updates the image and handle directly without a React render per move. Touch waits for horizontal intent; vertical scrolling, browser pinch and canceled gestures preserve the committed split. The native slider remains keyboard accessible.
2. Image inspection adds visible zoom-out/zoom-in/Fit controls, double-tap zoom, direct panning, and two-finger scaling after image zoom is enabled. The initial fit state leaves browser pinch zoom available; Ctrl/Cmd wheel is untouched. Pan bounds use the fitted image dimensions. Continuous edge resistance preserves interrupted drags and responds immediately when reversing; reduced motion settles without a spring. Sources, resizes and closing release captures, cancel animation frames and reset gesture baselines.
3. Revision history retains native horizontal scrolling and snap, with visible Previous/Next buttons and instant keyboard movement. Scrolling never runs AI, deletes an image or silently selects another revision.
4. The existing red/dark brand, native modal/focus behavior, provider keys, OAuth, backend and database are preserved. No dependency, schema change or paid provider call was required.
5. Source guidance: [Emil Kowalski gestures](https://github.com/emilkowalski/skills/blob/main/skills/gestures/SKILL.md) and [mobile-native](https://github.com/emilkowalski/skills/blob/main/skills/mobile-native/SKILL.md). Persistent installation into this cloud machine is blocked by the session's read-only filesystem. The source was read and applied directly; it was not installed on a different device and described as a cloud install.

## Verification

See evidence/gestures-release.json for final totals and measured budgets. Added geometry, pointer, cancellation, source/resize isolation, keyboard and browser touch-input tests. A fresh reviewer found three Important transition/cancellation defects; each was reproduced and fixed with regression coverage. Desktop and 320/390px screenshots were inspected, including zoomed output and revision-strip controls.

The browser tests include actual Chromium touch protocol input, rather than only dispatched DOM events. This is still browser emulation, not physical iPhone/Safari validation. Physical touch hardware was unavailable; do not claim testing it.

## Implementation choices

The existing native controls and small image-specific components fit this task; no general drawer framework was added. Before/after retains its established one-percent keyboard increments. Screen-reader range descriptions update on commit or keyboard change. Inspection follows the actual image aspect ratio, capped for tall images, to avoid oversized mobile letterboxing. These choices preserve existing navigation and page accessibility.
