import { describe, it, expect } from "vitest";
import {
  generationSchema,
  ownedPath,
  parseScores,
} from "../src/lib/validation";
import { pillars } from "../src/lib/types";
import { publicIPv4, referenceURL } from "../src/lib/reference";
const id = "11111111-1111-4111-8111-111111111111";
const base = {
  prompt: "A specific video concept",
  mode: "generate",
  style: "Auto",
  requestId: id,
};
describe("input, reference and score boundaries", () => {
  it("requires image input for recreate and edit", () => {
    expect(
      generationSchema.safeParse({ ...base, mode: "recreate" }).success,
    ).toBe(false);
    expect(generationSchema.safeParse({ ...base, mode: "edit" }).success).toBe(
      false,
    );
    expect(
      generationSchema.safeParse({
        ...base,
        mode: "edit",
        referencePath: id + "/a.png",
      }).success,
    ).toBe(true);
  });
  it("validates model controls and bounded batch size", () => {
    expect(generationSchema.parse(base).settings.batch).toBe(1);
    expect(
      generationSchema.safeParse({
        ...base,
        settings: {
          model: "sunburst",
          quality: "max",
          complexity: "high",
          format: "short",
          batch: 4,
        },
      }).success,
    ).toBe(true);
    expect(
      generationSchema.safeParse({ ...base, settings: { batch: 100 } }).success,
    ).toBe(false);
    expect(
      generationSchema.safeParse({ ...base, settings: { quality: "light" } })
        .success,
    ).toBe(false);
  });
  it("requires owned paths and rejects traversal", () => {
    expect(ownedPath(id + "/references/test.png", id)).toBe(true);
    for (const path of [
      "other/file.png",
      id + "/../other",
      id + "/%2e%2e/test",
      id + "/bad\\test",
    ])
      expect(ownedPath(path, id)).toBe(false);
  });
  it("normalizes all five Jev pillars and preserves uncertainty", () => {
    const score = parseScores({
      answers: Object.fromEntries(
        pillars.map((p) => [p, { score: 1.5, confidence: 0.4 }]),
      ),
    });
    expect(score.overall).toBe(50);
    expect(Object.keys(score.dimensions)).toEqual(pillars);
    expect(score.dimensions.virality.confidence).toBe(0.4);
    expect(score.note).toContain("Not measured CTR");
  });
  it("represents missing pillars as unknown without inventing zero", () => {
    const score = parseScores({
      answers: { clarity: { score: 3, confidence: 1 } },
    });
    expect(score.dimensions.clarity.score).toBe(100);
    expect(score.dimensions.idea.score).toBeNull();
    expect(score.overall).toBeNull();
  });
  it("blocks local, credentials-bearing and insecure reference URLs", () => {
    for (const url of [
      "http://example.com/a.png",
      "https://127.0.0.1/a",
      "https://host.internal/a",
      "https://user:pass@example.com/a",
    ])
      expect(() => referenceURL(url)).toThrow();
    for (const ip of [
      "127.0.0.1",
      "10.1.1.1",
      "169.254.169.254",
      "172.16.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "192.168.1.1",
      "224.0.0.1",
    ])
      expect(publicIPv4(ip)).toBe(false);
    expect(publicIPv4("8.8.8.8")).toBe(true);
  });
  it("resolves YouTube references to a fixed image host", () => {
    expect(referenceURL("https://youtu.be/dQw4w9WgXcQ").href).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });
});
