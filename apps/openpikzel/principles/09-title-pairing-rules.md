# 09 · Title pairing rules (the thumbnail must fit these)

Copied as-is from the packaging skill. The thumbnail carries the same entity + conflict as the title and never repeats its words.

# Title guidelines (Derrick's data-backed spec, applies to ALL titles)

Source: TITLE-GUIDELINES-for-AI (Derrick, 2026-11-08). Spanish long-form political commentary, Colombian right-of-centre audience. Priors, not laws.

## Priority
1. Subject: named entity + conflict. 2. House formula. 3. Form (verbs, caps, length). 4. Decoration (emoji, pipes, "?") has no effect: don't spend time on it.

## Hard rules (reject candidate if violated)
- H1 Length 40-70 chars incl. spaces. Hard max 85.
- H2 Exactly one named human/institutional antagonist, or one named protagonist with a conflict/exposé verb. Zero named actors = flop.
- H3 No meta/self-referential/event subjects (host speeches, awards, courses, "mi experiencia").
- H4 Never a verbatim quote as the whole title; quote fragment <= 40%.
- H5 No digits unless the number is the hook. Default: no numbers.
- H6 No first person (me, mi, respondo, denuncio, explico). Third person about the actors.
- H7 1-3 ALL-CAPS words, never 0, never whole title.
- H8 No Unicode styled letters, no leetspeak.
- H9 No interview/guest framing as hook.

## Soft scoring (add)
- Conflict verb (+): destroza, aplasta, humilla, desenmascara, desmonta, ataca, explota, enfrenta, refuta, derrota, frena.
- Opponent role noun (+): periodista, diputado, senador, juez, ministro, petrista, aliado, izquierdista, experto.
- Exposé verb (+): destapa, revela, filtra, esconde, oculta, nadie, verdad, delata.
- Urgency marker (max one, +): escándalo, urgente, grave, bomba, insólito.
- Superlative (small +): el peor, más corrupto, de la historia.
- Penalize: explainer framing (análisis, claves, explica), "you" address (tu, usted), abstract ideology noun with no human actor, leading "¿Por qué…?".
- Neutral: leading emoji, brand suffix, colon/pipe, generic "?".

## House formula (default for own channel)
[ACTOR] + conflict/exposé verb (past tense or present) + [ACTOR/ROLE] [+ short context]. Mix of No gire a la izquierda + Julio César Iglesias: "La DELIRANTE propuesta de Petro…", "ACTOR DESTROZÓ A ACTOR".
Avoid: macro-economics or reform explainers without a villain, foreign politics, single-actor announcements.

## Entity heat (Colombia, 2026-03 to 09; recompute monthly)
Petro x1.20, Abelardo/De La Espriella x1.12, Cepeda x1.05, Congreso x0.81, elecciones/encuestas x0.61, Paloma x0.53, Uribe x0.47. National figure as grammatical subject, secondary figure as object/context. Follow up a hit entity once; stop at first non-hit.

## Emotional levers, reframes and outliers (Derrick, 2026-11-10)
- Every title pulls ONE emotional lever, named before writing it:
  - MIEDO (fear): what is lost, what is coming, what threatens the viewer ("Lo que se viene con…", "El peligro de…").
  - INTRIGA (intrigue): a gap: something hidden, contradictory, unexplained ("Lo que nadie dijo de…", "La verdad detrás de…").
  - DESEO (desire): a win, the rival's defeat, justice, being proven right ("Así frenaron a…", "La jugada que tumbó…").
- Format reframes: when a candidate is flat, try at least one before discarding the topic:
  1. New format: drop the topic into a format already proven (on the channel or a neighbour outlier). Example: "$1 vs $100K katana" → "I tried every katana". Political: an exposé becomes a ranking or a comparison ("Todas las mentiras de X sobre Y", "X ANTES vs. X AHORA").
  2. Reframe as a question: "I built the most dangerous whip" → "How dangerous is a whip?". Political: "La reforma de X es peligrosa" → "¿Qué tan PELIGROSA es la reforma de X?". Keep the named actor; a leading "¿Por qué…?" stays penalized, so prefer "¿Qué tan…?", "¿Cuánto…?", "¿Quién…?", mostly in alternates.
- Outlier rule: outlier theory only fails when used wrong. Never copy an outlier just because it is one. Before borrowing a title or thumbnail from one, write in one line WHY it got people to click (viewer psychology: which lever, which gap, which actor) and carry over that mechanism, not the words. If the reason can't be stated, don't use it.
- Repackaging (also for stalled videos): change the lever and the frame, not just the words. Example: "4 Hidden Habits That Hurt Your Child's Confidence" (list, soft intrigue) → "The Fastest Way to Kill Your Child's Confidence" (one thing, fear, stronger verb). Political: "Tres errores de X en la reforma" → "El error que puede HUNDIR la reforma de X". Keep H5 (no digits) and H6 (no "you"/first person) when adapting.

## Procedure
1. Pick ONE protagonist (hottest entity) and ONE antagonist (role or person). If none: flag "weak subject: consider re-angle" and still proceed.
2. Name the lever (MIEDO, INTRIGA or DESEO). Generate 8 candidates, including at least one format reframe and one question reframe; reject on H1-H9, score by soft rules.
3. Return top 3 in the page: main title + 2 alternates, with at least one exposé framing and one conflict framing. Label alternates "Exposé: ..." / "Conflicto: ...".
4. Thumbnail text must carry the same entity + conflict.
5. Never overstate: titles must stay true to the script (attribution, presumption of innocence; e.g. do not say named prisoners "operaban" a network if the script says use is still to be established).
6. Mention in the reply that titles should be loaded into YouTube Test & Compare (3 titles/video) and logged in the Results log.
