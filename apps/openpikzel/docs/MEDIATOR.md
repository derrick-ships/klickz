# Mediator

Every image OpenPikzels renders is prompted by the mediator, never by the user's raw text.

1. `extractSubstantial` (code) pulls the substantial details from the raw prompt: quoted or labelled text (`texto:`, `text:`), every number as written, panel count (`3 paneles`, `split-screen`, `before & after` = 2), orientation.
2. `mediate` asks a text model (the user's OpenAI key, else Google) to write the enriched prompt, with the whole playbook (`principles/*.md`, Derrick's `thumbnail-playbook.zip`, files 00-10) as the only principles. Output: concept, lever, image text, panels, prompt, do's and don'ts with source file, declared substantial changes, and decisions it made because the user left them open.
3. `verifyEnriched` (code) rejects the answer if any quoted text or number disappeared without a declared change, the panel count changed silently, generic filler appears ("4k", "masterpiece"…), or rules don't cite the playbook. The mediator retries with the exact problems, up to 3 attempts.
4. If no valid enriched prompt comes back, nothing is rendered and nothing is charged for the image. There is no fallback to the raw prompt.
5. The image model receives `imagePromptFrom(...)`: enriched prompt + exact image text + panels + DO / DON'T lists + persona identity notes + the realism contract.
6. The route stores `lineage.mediator` (raw prompt, substantial details, enriched output, exact image prompt, provider/model, attempts, principle files) before rendering. The image page shows it under "What you asked vs. what was sent".

The one-click fix goes through the same path: its reviewed fix plan is the mediator's input.

Real runs (15 Nov 2026, OpenAI gpt-5.5 mediator + Flare 2.6 medium): "split-screen before & after arm transformation" → 2 panels, BEFORE/AFTER each on its own panel, universal palette (not the house look); mediator 19 s, image 7 s. Agencia Nacional de Tierras request with `Texto: "¿QUIÉN APROBÓ ESOS PAGOS?"` → exact text verbatim, house look, no invented face; mediator 39 s, image 8 s.
