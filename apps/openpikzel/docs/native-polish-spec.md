# Native polish spec (op/native-polish)

Principles: Jakob's Law (behave like YouTube / Google Photos / iOS: things live where people expect), recognition over recall (the next action is visible, labelled, with icon + word; nothing must be remembered).

Priorities, in order:
1. Protect existing workflows. Before moving anything, write docs/feature-map.md: every user action, where it lives today (screen, container, label), desktop and phone. After the change, re-check every row. No action may disappear.
2. Make actions discoverable: the next action is visible, not hidden behind hover or memory.
3. Immediate feedback: skeletons, safe optimistic updates, accurate success states.
4. Native polish: smooth corners, stable numbers, shared transitions, autofill, responsive images.
5. Test task completion: create, score, fix, download, edit, delete+undo, add key, sign in.

The 10 techniques, where they apply:
1. Skeleton loaders: studio first load (sidebar history, composer, result), My creations grid, score panel while scoring, People/Styles dialogs, /connect key status. Same geometry as the loaded layout (no layout shift).
2. Optimistic UI (safe only): favorite toggle, rename (chat/creation/profile), delete (already queued with Undo), chat creation, selection. NEVER optimistic for paid work (create, score, fix): those show honest progress. Roll back + plain error on failure.
3. Tabular numbers: every score (overall, pillars, score deltas, badges), counters, timers ("Send again in 55s"), batch counts, costs, API activity times. font-variant-numeric: tabular-nums.
4. Squircle corners: cards, buttons, dialogs, sheets, thumbnails, chips. Use CSS corner-shape: squircle where supported (@supports), with the existing border-radius as fallback; keep radii tokens.
5. Swipe to dismiss: phone bottom sheets (More sheet, See-scores sheet, Help sheet, dialogs rendered as sheets at <=640px) and toasts (Undo/notice): drag down / swipe sideways to dismiss with 1:1 finger tracking, velocity threshold, spring back, respects reduced motion; Esc and close button stay.
6. Shared transitions: thumbnail in grid/timeline -> result view image (View Transitions API with view-transition-name per creation id; fallback: none). Mode switch Create <-> Score keeps the composer in place. Respect prefers-reduced-motion.
7. SMS/OTP code autofill: sign-in code field already has autocomplete="one-time-code"; add WebOTP (navigator.credentials.get otp) only if the code is sent by SMS (it's email, so skip WebOTP); ensure paste of an 8-digit code anywhere fills it, inputmode numeric, autofocus on the code step, auto-submit when complete length is entered. Also email field autocomplete="email" and the key field autocomplete="off" + paste button.
8. Undo actions: already for creation/profile delete. Extend to: chat delete (soft, 6 s), favorite toggle, rename, "Improve prompt" (exists), removing a person/style/reference chip from the composer, clearing the prompt. One shared toast component, one place on screen, keyboard reachable.
9. Balanced line breaks: text-wrap: balance on headings and short multi-line labels (h1-h3, dialog titles, empty-state lines, verdict sentence, button labels that can wrap); text-wrap: pretty on paragraphs.
10. Blur placeholders: every thumbnail image (grid, timeline, result, history, style library, people covers): a tiny blurred preview or dominant-colour placeholder shown until load, fixed aspect-ratio box (16:9 / 9:16) so nothing shifts; fade in on load; also for welcome example image.

Non-goals: no change to providers, billing, DB, routes, MCP names, scoring.
Constraints: one red button per view; copy law in docs/grandma-spec.md still applies (tests/copy-law.test.ts must pass).
