# 03 · House prompt template (Runrun Político / Noticias BQ)

The style is locked to the Actions2.5 reference page (Hollman Morris): documentary look, teal↔orange gradient, the real photo of the subject as focal point, two lines of ALL CAPS text in yellow + white, red only on ¿ ?, small play button top-left, no date, no logo.

- **The prompt is written in English.** The text inside the image stays in **Spanish**, spelled exactly (accents, ¿ ¡, commas).
- The prompt always assumes a **reference photo of the real person is attached** ("the attached man/woman… faithful to reference image"). Never ask the model to invent a politician's face.

## Brief block (what goes on the Notion page)
```
### Recomendado · [THUMBNAIL TEXT or short concept]        ← pairs with the main title
### Promesa: [promise in a few words] · [alternate title]  ← one per alternate
Sujeto: [Person], usa una foto de [Person]
[code block with the English prompt]
```

## Template
```txt
Documentary-style YouTube thumbnail. {GRADIENT} with a strong vignette. The subject is the attached {man/woman}, {FULL NAME}, cutout against the gradient, tight head-and-shoulders, positioned on the {left/right} side of frame, facing {right/left}, {EXPRESSION}, faithful to reference image. High contrast, harsh side light, slight rim light separating subject from background, sharp focus, light grain. Faint, heavily blurred background element showing {ONE CONTEXT OBJECT}. Text overlay in bold condensed sans-serif ALL CAPS with thick black outline (2-3px) and drop shadow, very large, positioned center-{right/left} in clean open space, spanning 45% of frame width. Top line reads "{LINE 1}" in bright yellow (#FFD700). Bottom line reads "{LINE 2}" in white. {RED RULE}. YouTube play button (red, white triangle) in top-left corner. No date. No channel logo. No text other than the two lines. Documentary aesthetic with {MOOD 1}, {MOOD 2}, high contrast.
```

## Slot rules
| Slot | Rule | Options |
|---|---|---|
| GRADIENT | Alternate between the 3 thumbnails of a video so they look different in Test & Compare | A: "Dark teal-to-orange gradient background (#008080 to #FF6600)" · B: "Orange-to-teal gradient background (warm orange #FF6600 to deep teal #008080)" |
| Side | Subject on one third, text in the open space on the other. Alternate it between variants too | Subject left, facing right → text center-right · Subject right, facing left → text center-left |
| EXPRESSION | Must match the lever and stay faithful to the person | Intrigue: evasive, looking slightly away / guarded / suspicious · Fear: tense / worried / somber · Conflict: angry, mid-speech / defiant · Desire: confident, proud half-smile / triumphant |
| CONTEXT OBJECT | ONE object, faint and heavily blurred. It supports the subject and never competes with it. Concrete and visual | case file folder with Fiscalía seal, courtroom gavel, wall calendar page, stadium at night with floodlights, unlit torch cauldron in empty stadium, city skyline, M-19 flag, Congress chamber, ballot box, stacks of cash, prison bars |
| LINE 1 / LINE 2 | 2-4 words in total, from the text bank (04). Line 1 carries the hook word. A question splits over the two lines ("¿QUIÉN NO" / "PAGÓ?") | See 04 |
| RED RULE | If the text has ¿ ?: `Red only on the "¿" and "?".` · If not: `No red text.` | Red is never used on a whole word |
| MOOD | 2 adjectives that match the lever | investigative, somber, accusatory, judicial, tense, confrontational, political, triumphant, civic pride |

## Hard constraints to keep in every prompt
- "No date. No channel logo. No text other than the two lines."
- Never two faces competing. If the story is a contrast between two people (Petro vs Char), choose ONE face per thumbnail and let the other side live in the object or the text. A split-screen with two faces is only an exception, for a test, and both faces must stay large.
- Don't distort or caricature the real person (no fake tears, no handcuffs or prison clothes on someone who hasn't been convicted). The expression comes from a real photo.
- No symbols, uniforms or objects that imply a crime the script doesn't support (see 05).

## Pre-send prompt check
- [ ] The image text is spelled exactly in Spanish, with accents and ¿¡
- [ ] 2-4 words, two lines, yellow on top / white below
- [ ] The red rule matches the text (questions only)
- [ ] One face, one faint object, nothing else
- [ ] Gradient and side alternate across the 3 variants
- [ ] The expression matches the lever
- [ ] The text doesn't repeat the title it's paired with
