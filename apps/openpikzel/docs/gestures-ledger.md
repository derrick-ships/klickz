# SDD ledger — plan: docs/superpowers/plans/2026-11-08-gestures.md
Pre-flight: tasks share only the creative stylesheet; focused selectors preserve existing controls.
Ruling: use an isolated source snapshot with existing dependency symlink, as earlier releases did; GitHub connector is the authenticated publication path. No local Git credential is required.
Ruling: cloud skill installation is blocked by the read-only environment. Apply fetched source guidance now; do not install elsewhere and misreport it as here.
Tests: six geometry cases passed; four new browser tests failed against the baseline for coordinate drift, absent inspection controls and absent history controls.
Final review: three Important findings reproduced. Source-change harness required embedded public example images because an opaque document cannot fetch loopback resources; corrected fixture, then observed unwanted0.9px pan at fit.
Fix pass: preserve existing edge displacement, use continuous resistance, reset/release contacts and all gesture baselines on geometry/source changes, defer touch comparison until horizontal intent and roll back canceled gestures.
Visual refinement: inspection frame follows actual image aspect ratio, capped for tall images; avoids oversized black space on mobile.
Task1 complete:99 unit/API/DB tests pass;8 gesture browser tests pass, including real CDP touch input. Review fixes: continuous edge resistance and pinch joining, stale pointer/geometry/source cleanup, comparison cancellation rollback; each covered by observed failing regression before the fix.
Task2 complete:45 functional browser checks and2 performance browser checks pass; mobile/desktop Lighthouse gates pass. Fresh reviewer fix pass complete; no additional review dispatched.
