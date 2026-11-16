import { it, expect, vi, afterEach } from "vitest";
import sharp from "sharp";
import { providerContext } from "../src/lib/provider-context";
import { evaluateThumbnail } from "../src/lib/providers";
import { modelPreferenceContext, defaultModelPreferences } from "../src/lib/model-preferences";
import { pillars } from "../src/lib/types";
import { scorerOrder, canScore } from "../src/lib/scorers";
import { keepFlag, wordCount, wordFlag } from "../src/lib/flag-policy";
import { fallbackNote, scorePlan } from "../src/lib/score-on-generate";
import { jevQuestions, openaiQuestions, OPENAI_DECISION_MODEL } from "../src/lib/decision-scorers";
import { jevReply } from "./fixtures/jev-reply";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const image = () => sharp({ create: { width: 1280, height: 720, channels: 3, background: "#dc384b" } }).png().toBuffer();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const quiet = () => vi.spyOn(console, "info").mockImplementation(() => {});

/** An OpenAI Decisions API reply in its documented shape: score answers with labelled level probabilities, predicates. */
function openaiDecision(level = 2) {
  return {
    model: OPENAI_DECISION_MODEL,
    answers: [
      ...pillars.map((p) => ({ type: "score", name: p, score: level, confidence: 0.8, probabilities: [0, 1, 2, 3].map((v) => ({ value: v, label: "L" + v, probability: v === level ? 1 : 0 })) })),
      { type: "predicate", name: "flag_tiny_text", probability: 0.96 },
      { type: "refusal", name: "flag_platform_safety_risk" },
    ],
    usage: { input_tokens: 2000, output_tokens: 0, total_tokens: 2000, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  };
}
const run = <T,>(keys: Record<string, string>, work: () => Promise<T>) =>
  providerContext.run(keys, () => modelPreferenceContext.run(defaultModelPreferences, work));

it("tries decision models first: Jev, then OpenAI Decisions, then the chosen reviewer, then other keys", () => {
  const all = { jev: true, openai: true, anthropic: true, google: true };
  expect(scorerOrder("jev", "anthropic", all)).toEqual(["jev", "openai", "anthropic"]);
  expect(scorerOrder("jev", "anthropic", { openai: true, anthropic: true })).toEqual(["openai", "anthropic"]);
  expect(scorerOrder("model", "anthropic", all)).toEqual(["anthropic", "jev", "openai"]);
  expect(scorerOrder("jev", null, { google: true })).toEqual(["google"]);
  expect(scorerOrder("jev", null, {})).toEqual([]);
  expect(canScore({ anthropic: true })).toBe(true);
  expect(canScore({ youtube: true } as never)).toBe(false);
  expect(scorePlan({ jev: false, google: true })).toMatchObject({ review: true, critiqueProvider: "google" });
});

it("scores with OpenAI's decision model when Jev fails, and records the route", () =>
  run({ jev: "jev-fixture", openai: "openai-fixture" }, async () => {
    const log = quiet();
    const fetcher = vi.fn(async (url: unknown, init?: { body?: string }) => {
      if (String(url).includes("typesafe.ai")) return json({ error: "overloaded" }, 529);
      if (String(url).includes("/v1/decisions")) { (fetcher as unknown as { body: unknown }).body = JSON.parse(init!.body!); return json(openaiDecision(2)); }
      throw new Error("unexpected call " + url);
    });
    vi.stubGlobal("fetch", fetcher);
    const score = await evaluateThumbnail(await image(), "A real video title", "req-1", { videoBrief: "", audience: "", includeVision: false });
    expect(score.overall).not.toBeNull();
    expect(score.dimensions.clarity.score).toBe(67);
    expect(score.scoring?.route).toEqual([
      { scorer: "jev", outcome: "failed", reason: "Jev returned an error (529)." },
      { scorer: "openai", outcome: "scored" },
    ]);
    expect(score.contributors?.[0]).toMatchObject({ provider: "OpenAI Decisions API", model: OPENAI_DECISION_MODEL, role: "scoring" });
    // The decision model's yes/no flag counts even without the image review; a refused question is simply not applied.
    expect(score.dimensions.clarity.flags).toContain("tiny_text");
    expect(score.penalties).toContainEqual({ flag: "tiny_text", points: 6 });
    expect(fallbackNote(score)).toBe("Scored by OpenAI · Jev didn’t answer");
    const body = (fetcher as unknown as { body: { model: string; questions: { type: string; name: string; levels?: unknown[] }[]; input: { content: { type: string }[] }[] } }).body;
    expect(body.model).toBe("gpt-6-luna");
    expect(body.questions.filter((q) => q.type === "score").map((q) => q.name)).toEqual([...pillars]);
    expect(body.questions.find((q) => q.name === "clarity")!.levels).toHaveLength(4);
    expect(body.questions.some((q) => q.type === "predicate" && q.name === "flag_tiny_text")).toBe(true);
    expect(body.input[0].content.map((c) => c.type)).toEqual(["input_json", "input_image", "input_image"]);
    expect(log.mock.calls.some(([line]) => String(line).includes('"route":["jev:failed","openai:scored"]'))).toBe(true);
  }));

it("falls back to a language model with the same rubric when no decision model answers", () =>
  run({ anthropic: "sk-ant-fixture" }, async () => {
    quiet();
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).includes("/v1/models")) return json({ data: [{ id: "claude-sonnet-5-5" }] });
      if (String(url).includes("/v1/messages")) return json({ content: [{ type: "text", text: JSON.stringify({ answers: Object.fromEntries(pillars.map((p) => [p, { level: 3 }])) }) }] });
      throw new Error("unexpected call " + url);
    });
    vi.stubGlobal("fetch", fetcher);
    const score = await evaluateThumbnail(await image(), "", "req-2", { videoBrief: "", audience: "", includeVision: false });
    expect(score.overall).toBe(100);
    expect(score.dimensions.idea.score).toBe(100);
    expect(score.dimensions.curiosity.missingReason).toBeUndefined();
    expect(score.imageOnly).toBe(true);
    expect(score.scoring?.route).toEqual([{ scorer: "anthropic", outcome: "scored" }]);
    expect(score.scoring?.injection).toBeUndefined();
    // No over-explaining: no "add a title" warning when there is no title.
    expect(score.warnings?.some((w) => /title/i.test(w) && /add/i.test(w))).toBe(false);
  }));

it("only fails when every connected scorer fails, naming each reason", () =>
  run({ jev: "jev-fixture", openai: "openai-fixture" }, async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => String(url).includes("typesafe.ai") ? json({}, 401) : json({ error: { message: "x" } }, 429)));
    const error = await evaluateThumbnail(await image(), "A title", "req-3", { videoBrief: "", audience: "", includeVision: false }).then(() => null, (e) => e);
    expect(error.message).toContain("Jev rejected the API key.");
    expect(error.message).toContain("OpenAI is rate-limiting or out of balance.");
    expect(error.scorerAttempts).toHaveLength(2);
  }));

it("no title: Idea and Curiosity are judged from the image, and the title-only flags are not even asked", () => {
  const state = { title: null, intendedPromise: null, videoFacts: null, previewWidth: 200 };
  const jev = jevQuestions(state);
  expect(jev).not.toHaveProperty("flag_text_repeats_title");
  expect(jev).not.toHaveProperty("flag_depends_on_title");
  expect(String((jev.idea as { instructions: string }).instructions)).toContain("judge what the image alone promises");
  expect(openaiQuestions(state).some((q) => q.name === "flag_text_repeats_title")).toBe(false);
  const titled = jevQuestions({ ...state, title: "A title" });
  expect(titled).toHaveProperty("flag_text_repeats_title");
});

it("code owns the flag rules: word count, title-only flags, authorized faces and marks", () => {
  expect(wordCount("¿QUIÉN APROBÓ ESOS PAGOS?")).toBe(4);
  expect(wordCount("NO CUADRA / ¿Y LA BOINA?")).toBe(5);
  const base = { hasTitle: true, hasFacts: true, peopleAuthorized: false, marksAuthorized: false, reviewed: true, readableText: "NO CUADRA" };
  expect(wordFlag(base)).toBe(false);
  expect(wordFlag({ ...base, readableText: "THIS HAS WAY TOO MANY WORDS" })).toBe(true);
  expect(keepFlag("too_many_words", base)).toBe(false);
  expect(keepFlag("too_many_words", { ...base, reviewed: false })).toBe(true);
  expect(keepFlag("text_repeats_title", { ...base, hasTitle: false })).toBe(false);
  expect(keepFlag("real_person_without_reference", { ...base, peopleAuthorized: true })).toBe(false);
  expect(keepFlag("logo_or_date_present", { ...base, marksAuthorized: true })).toBe(false);
  expect(keepFlag("tiny_text", base)).toBe(true);
});

it("a creator's own uploaded thumbnail is never penalised for its own face or logo", () =>
  run({ jev: "jev-fixture" }, async () => {
    quiet();
    vi.stubGlobal("fetch", vi.fn(async () => json(jevReply({ nouls: { real_person_without_reference: 0.97, logo_or_date_present: 0.95 } }))));
    const own = await evaluateThumbnail(await image(), "A title", "req-4", { videoBrief: "", audience: "", includeVision: false, peopleAuthorized: true, marksAuthorized: true });
    expect(own.globalFlags ?? []).toEqual([]);
    expect(own.scoring?.injection).toBe(0.02);
    expect(own.penalties).toEqual([]);
    const generated = await evaluateThumbnail(await image(), "A title", "req-5", { videoBrief: "", audience: "", includeVision: false });
    expect(generated.penalties?.map((p) => p.flag).sort()).toEqual(["logo_or_date_present", "real_person_without_reference"]);
  }));
