import { it, expect } from "vitest";
import { parseScores } from "../src/lib/validation";
import { readJevFlags } from "../src/lib/jev-questions";
import { jevReply } from "./fixtures/jev-reply";

it("parses a real-shaped Jev reply: five Score answers plus Noul flag answers", () => {
  const reply = jevReply({ scores: { virality: 1.43, clarity: 3, idea: 2, curiosity: 0.5, emotion: 2 } });
  const score = parseScores(reply);
  expect(score.dimensions.virality.score).toBe(48);
  expect(score.dimensions.clarity.score).toBe(100);
  expect(score.overall).not.toBeNull();
});

it("keeps Jev's model id and each pillar's probabilities for the record", () => {
  const score = parseScores(jevReply({ model: "jev-1.14.0" }));
  expect(score.jev?.model).toBe("jev-1.14.0");
  expect(score.dimensions.idea.probabilities).toMatchObject({ "2": 1 });
});

it("ignores unknown or malformed extra answers instead of failing the whole score", () => {
  const reply = jevReply() as { answers: Record<string, unknown> };
  reply.answers.something_new = { type: "choice", choice: "x", confidence: 0.4 };
  reply.answers.flag_broken = { type: "noul" };
  expect(() => parseScores(reply)).not.toThrow();
});

it("reads the flag Nouls from the same reply", () => {
  const flags = readJevFlags(jevReply({ nouls: { tiny_text: 0.97 } }).answers);
  expect(flags.pillars.clarity).toContain("tiny_text");
});
