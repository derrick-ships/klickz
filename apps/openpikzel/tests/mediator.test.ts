import { it, expect, vi, beforeEach, describe } from "vitest";
import { extractSubstantial, verifyEnriched, imagePromptFrom, mediate, type Enriched } from "../src/lib/mediator";
import { providerContext } from "../src/lib/provider-context";
import { principles, principleFiles } from "../src/lib/principles.generated";

const create = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: create.fn }; } }));

const enriched = (over: Partial<Enriched> = {}): Enriched => ({
  concept: "Arm transformation before and after",
  lever: "DESEO",
  imageText: ["BEFORE", "AFTER"],
  panels: 2,
  prompt: "Horizontal 16:9 split-screen YouTube thumbnail. Left panel labelled \"BEFORE\": a woman in a grey tank top in a gym, pinching soft upper arm, worried expression. Right panel labelled \"AFTER\": the same woman flexing a toned bicep, proud smile. Bold condensed white sans text with thick black outline in negative space. Yellow #FFD700 accent. High contrast, rim light on both faces, background softly blurred.",
  dos: [
    { rule: "Keep one focal point per panel", source: "02-visual-rules-dos-donts" },
    { rule: "Use bold condensed sans text, 2-4 words", source: "00-README-cheat-sheet" },
    { rule: "Put text in negative space", source: "02-visual-rules-dos-donts" },
    { rule: "High contrast that survives grayscale", source: "02-visual-rules-dos-donts" },
  ],
  donts: [
    { rule: "No thin or script fonts", source: "02-visual-rules-dos-donts" },
    { rule: "No date or logo", source: "03-house-style-prompt-template" },
    { rule: "No more than 2-3 elements", source: "00-README-cheat-sheet" },
    { rule: "Do not repeat the title on the image", source: "01-principles" },
  ],
  substantialChanges: [],
  decisions: ["Chose BEFORE/AFTER as on-image text because the user gave none."],
  ...over,
});

describe("principles", () => {
  it("bundles all eleven playbook files verbatim", () => {
    expect(principleFiles).toHaveLength(11);
    expect(principles).toContain("The thumbnail never repeats the title");
    expect(principles).toContain("=== 05-legal-and-accuracy.md ===");
  });
});

describe("extractSubstantial", () => {
  it("keeps quoted text, numbers, panels and orientation exactly as written", () => {
    const s = extractSubstantial('Petro con un expediente, texto: "¿QUIÉN APROBÓ ESOS PAGOS?" y $979.000 millones, 537 predios, 3 paneles, vertical', "long");
    expect(s.exactText).toContain("¿QUIÉN APROBÓ ESOS PAGOS?");
    expect(s.numbers).toEqual(expect.arrayContaining(["$979.000 millones", "537", "3"]));
    expect(s.panels).toBe(3);
    expect(s.orientation).toBe("vertical");
  });
  it("reads a split-screen / before & after request as two panels and leaves text open when none was given", () => {
    const s = extractSubstantial("Make a split-screen thumbnail showing a dramatic before & after' arm transformation", "long");
    expect(s.panels).toBe(2);
    expect(s.exactText).toEqual([]);
  });
});

describe("verifyEnriched", () => {
  it("accepts an enriched prompt that keeps every substantial detail", () => {
    const sub = extractSubstantial('Split-screen with the text "BEFORE" and "AFTER"', "long");
    expect(verifyEnriched(sub, enriched())).toEqual([]);
  });
  it("rejects silently dropped text, numbers, panel changes and generic filler", () => {
    const sub = extractSubstantial('Text "SOLO 3" about 537 predios, split-screen', "long");
    const bad = enriched({ imageText: ["NO CUADRA"], panels: 1, prompt: enriched().prompt + " masterpiece, 4k" });
    const problems = verifyEnriched(sub, bad);
    expect(problems.join("\n")).toMatch(/SOLO 3/);
    expect(problems.join("\n")).toMatch(/537/);
    expect(problems.join("\n")).toMatch(/panel/);
    expect(problems.join("\n")).toMatch(/filler/);
  });
  it("accepts a substantial change only when it is declared on its own line", () => {
    const sub = extractSubstantial('Text "PETRO ROBÓ"', "long");
    const declared = enriched({ imageText: ["¿PETRO ROBÓ?"], prompt: enriched().prompt.replace('"BEFORE"', '"¿PETRO ROBÓ?"'), substantialChanges: ['Changed "PETRO ROBÓ" to "¿PETRO ROBÓ?" because 05-legal-and-accuracy requires a question without a conviction'] });
    expect(verifyEnriched(sub, declared)).toEqual([]);
  });
});

describe("imagePromptFrom", () => {
  it("is the enriched prompt plus explicit DO/DON'T lists, never the raw request", () => {
    const raw = "make it pop lol";
    const out = imagePromptFrom(enriched(), ["IDENTITY: reference images 1-2 show Guillo"], "REALISM LEVEL: HIGH");
    expect(out).not.toContain(raw);
    expect(out).toContain("DO:\n- Keep one focal point per panel");
    expect(out).toContain("DON'T:\n- No thin or script fonts");
    expect(out).toContain('line 1: "BEFORE"; line 2: "AFTER"');
    expect(out).toContain("IDENTITY: reference images 1-2 show Guillo");
  });
});

describe("mediate", () => {
  beforeEach(() => create.fn.mockReset());
  const input = { rawPrompt: 'Split-screen, text "BEFORE" and "AFTER"', title: "", format: "long" as const, style: "Auto", notes: [], variation: 1, hasPersona: false, isEdit: false };

  it("sends the principles to the mediator and retries with the exact problems when a detail is dropped", async () => {
    create.fn
      .mockResolvedValueOnce({ output_text: JSON.stringify(enriched({ imageText: ["TRANSFORMATION"], prompt: enriched().prompt.replaceAll('"BEFORE"', '"X"') })) })
      .mockResolvedValueOnce({ output_text: JSON.stringify(enriched()) });
    const result = await providerContext.run({ openai: "sk-test" }, () => mediate(input));
    expect(result.attempts).toBe(2);
    const first = create.fn.mock.calls[0][0];
    expect(first.instructions).toContain("=== 02-visual-rules-dos-donts.md ===");
    const second = JSON.parse(create.fn.mock.calls[1][0].input[0].content[0].text.replace(/^Answer in JSON\. Data:\n/, ""));
    expect(second.previousAttemptProblems.join(" ")).toContain("BEFORE");
  });

  it("never falls back to the raw prompt: it throws when no valid enriched prompt is produced", async () => {
    create.fn.mockResolvedValue({ output_text: JSON.stringify({ prompt: "x" }) });
    await expect(providerContext.run({ openai: "sk-test" }, () => mediate(input))).rejects.toThrow(/Nothing was generated/);
    expect(create.fn).toHaveBeenCalledTimes(3);
  });

  it("needs a text provider key before anything is rendered", async () => {
    await expect(providerContext.run({}, () => mediate(input))).rejects.toThrow(/OpenAI or Google API key/);
    expect(create.fn).not.toHaveBeenCalled();
  });
});

describe("extractSubstantial false positives (audit 15 Nov)", () => {
  it("ignores JSON punctuation, 'sin texto:' and 'short text'", () => {
    const plan = 'Execute this plan <reviewed-plan-data>{"title":"Petro PERDIÓ el control","operations":[{"instruction":"Keep readable short text"}],"preserve":{"exactText":["SIN / MAYORÍA"]}}</reviewed-plan-data>';
    const s = extractSubstantial(plan, "long");
    expect(s.exactText.every((t) => /[\p{L}\p{N}]/u.test(t))).toBe(true);
    expect(s.orientation).toBe(null);
    expect(extractSubstantial("Petro serio en el Congreso, sin texto: solo la cara y el fondo", "long").exactText).toEqual([]);
    expect(extractSubstantial("Make it vertical for YouTube Shorts", "long").orientation).toBe("vertical");
  });
});

import { variationAxis } from "../src/lib/mediator";
describe("variationAxis", () => {
  it("gives every image of a 16-batch a different combination and none for a single image", () => {
    expect(variationAxis(1, 1)).toBeNull();
    const combos = Array.from({ length: 16 }, (_, i) => JSON.stringify(variationAxis(i + 1, 16)));
    expect(new Set(combos).size).toBe(16);
    const placements = new Set(Array.from({ length: 4 }, (_, i) => variationAxis(i + 1, 4)!.placement));
    expect(placements.size).toBe(4);
  });
});

describe("on-image text lines (15 Nov: black box behind a letter, slash drawn)", () => {
  it("splits ' / ' into lines and never asks for boxes behind letters", () => {
    expect(extractSubstantial('Text: "¿Y LA / BOINA?"', "long").exactText).toEqual(["¿Y LA", "BOINA?"]);
    const p = imagePromptFrom({ concept: "", lever: "INTRIGA", imageText: ["¿Y LA / BOINA?"], panels: 1, prompt: "A beret on a podium.", dos: [], donts: [], decisions: [], substantialChanges: [] } as never, [], "");
    expect(p).toContain('line 1: "¿Y LA"; line 2: "BOINA?"');
    expect(p).toMatch(/no box, plate, band or rectangle behind any letter/);
    for (let i = 1; i <= 16; i++) expect(variationAxis(i, 16)!.highlightWord).not.toMatch(/\bbox\b/);
  });
});

describe("mediator sees the attached references", () => {
  it("sends reference images with the request so logos and faces are not guessed", async () => {
    create.fn.mockReset();
    create.fn.mockResolvedValueOnce({ output_text: JSON.stringify(enriched()) });
    const photo = Buffer.from("not-a-real-image");
    const seen = { rawPrompt: 'Split-screen, text "BEFORE" and "AFTER"', title: "", format: "long" as const, style: "Auto", notes: [], variation: 1, hasPersona: false, isEdit: false, referenceImages: [photo] };
    await providerContext.run({ openai: "sk-test" }, () => mediate(seen));
    const content = create.fn.mock.calls[0][0].input[0].content;
    expect(content.some((part: { type: string }) => part.type === "input_image")).toBe(true);
    const data = JSON.parse(content[0].text.replace(/^Answer in JSON\. Data:\n/, ""));
    expect(data.referenceImageCount).toBe(1);
    expect(data.referenceImages).toBeUndefined();
    expect(create.fn.mock.calls[0][0].instructions).toMatch(/mark to COPY/);
  });
});
