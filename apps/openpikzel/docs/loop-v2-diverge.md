# LOOP v2 — divergence before implementation

These are design hypotheses, not measured conversion outcomes. The red/dark identity and exact required headline remain fixed. The four sequential lenses are recorded in evidence/loop-v2-{grandma,competitor,power,designer}.json.

## A. Conservative: protect the work, explain the key
Make selecting the already-active chat a no-op; search autosaved draft text as well as titles and finished creations. Explain API keys and link the selected provider's official setup guide beside the masked field. Increase essential save/revision/help text.
Evidence: POWER-V2-01 reproduction (loop-v2-active-chat-failure.log and screenshots), draft search source; G-02, C2 and designer setup observations.
Effort: low. Risk: low to medium because draft navigation affects persistence. Learning: regression tests establish preservation; onboarding usability remains a hypothesis until tested with people.
Tradeoff: adds a little setup text and height; does not eliminate the need for a provider account.

## B. Structural: choose a job before connecting a provider
Start Connections with “Create an image”, “Score a thumbnail”, or “Find channel references”, then show only the relevant provider setup and a return-to-task action. Keep all existing connections in a secondary management view.
Evidence: C2, G-02 and DES-V2-02 describe the gap between intent and provider jargon.
Effort: medium. Risk: routing, keyboard focus and preserving the pending generation draft across sign-in. Learning: observe setup completion and wrong-provider choices.
Tradeoff: an extra step for experienced users; migration of existing direct links needs testing.

## C. Wildcard / new pattern: a no-spend rehearsal with an inspectable decision receipt
Offer a clearly labelled local rehearsal: upload an existing image, try a small feed preview and export a resize, with a receipt showing source, operation, storage location and “No provider request”. AI actions remain separate and explain the required connection. This receipt is a proposed new pattern, distinct from existing generation history.
Evidence: C1/DES-V2-07 need a visible workflow; current local resize/export can demonstrate actual free utility without invented AI results.
Effort: medium to high. Risk: confusing rehearsal with real generation, onboarding bloat and additional state. Learning: whether visitors understand the actual product before entering a key.
Tradeoff: it cannot establish image-model quality or real scoring accuracy. No fixture may be marketed as a provider result.

## Selection
Pending the seven-role critic panel. No app changes in this continuation precede this record.

## Chosen after critic triage
Choose A in separate draft-continuity and provider-guidance batches, followed by essential-text legibility. The seven-role panel (one synthesis agent using seven stated perspectives, not seven independent evaluators) identifies two P1 issues: T01 active-chat overwrite and T02 newcomer setup. A directly addresses these with bounded state changes. B and C remain options for another round after learning from this patch; their larger flow changes need more state and onboarding validation. The missing worked example is retained as P2 with inferred conversion impact, not dismissed or presented as solved. See evidence/loop-v2-critic-panel.json for ranked findings, closure criteria and failed signoff.
