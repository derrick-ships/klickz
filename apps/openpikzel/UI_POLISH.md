# UI polish — November 7, 2026

All four screenshots from user message `Sentinel_a073f83f82d88191949489da3e2d60f9` were retrieved and visually inspected: IMG_9011 (composer/pills/dots), IMG_9012 (sidebar/relief), IMG_9013 (split Generate/batch action), IMG_9009 (light and depth). Images are reference material only and are not bundled in the site or repository. The user’s red OpenPikzels identity and existing app functionality remain.

| Before | After | Why |
| --- | --- | --- |
| Separate Play/Pause control on brand art | No control; one finite muted take, then poster | Follow the explicit request without introducing endless inaccessible motion |
| Flat controls and plain workspace | Feathered static dots, dark surface relief and restrained red highlight | Match the supplied visual direction with the app’s own palette |
| Nested prompt box and hard state changes | Continuous composer, shared focus boundary, 120–180ms control feedback and 180ms dialog entry | Cleaner task hierarchy and immediate feedback |
| Five crowded mobile mode buttons; all tabs focusable | Balanced wrapping, 44px mobile targets and Arrow/Home/End roving focus | Improve touch/keyboard navigation while retaining every mode |

Motion never loops. The normal take stops after 4.4s plus a 240ms dissolve, on editing, when hidden/offscreen or on preference change. Reduced-motion/data-saving visitors do not load video. Browser autoplay refusal falls back to the existing still. No animation library, tracking, external media request or new generation cost was added.

Verification: 69 unit/database/route/protocol tests, production TypeScript/build and 14 Playwright browser tests. Local captures `evidence/openpikzels-polished-1440.png` and `evidence/openpikzels-polished-390.png`; 320/768 layouts also exercised with long prompt content and dialogs. Existing drafts, references, personas, model/batch settings, resizing, OAuth consent, widget and partial diagnostic tests still pass. Real application-provider validation remains pending, independent of visual polish.
