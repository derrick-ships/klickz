import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapWords, fitText, TITLE_SIZES } from "./layout.ts";

/**
 * Synthetic metrics: every glyph is half the font size wide. Deterministic,
 * no fonts, no canvas — which is exactly why layout.ts takes an injected
 * measure function instead of reaching for a 2D context.
 */
const measureAt = (size: number, text: string) => text.length * size * 0.5;
const at = (size: number) => (text: string) => measureAt(size, text);

test("wrapWords breaks a line once it exceeds the max width", () => {
  // At size 10 each char is 5 wide, so 100px fits 20 characters.
  const lines = wrapWords("the quick brown fox jumps".split(" "), at(10), 100);
  assert.deepEqual(lines, ["the quick brown fox", "jumps"]);
});

test("wrapWords keeps an over-long single word on its own line", () => {
  // "supercalifragilistic" is 20 chars = 100px at size 10, well over a 30px box.
  // It must still appear, on its own line, rather than loop forever or vanish.
  const lines = wrapWords(["hi", "supercalifragilistic", "there"], at(10), 30);
  assert.deepEqual(lines, ["hi", "supercalifragilistic", "there"]);
});

test("wrapWords returns an empty array for empty input", () => {
  assert.deepEqual(wrapWords([], at(10), 100), []);
  assert.deepEqual(wrapWords(["", ""], at(10), 100), []);
});

test("wrapWords loses no words", () => {
  const words = "how to build a thumbnail generator that actually works".split(" ");
  const lines = wrapWords(words, at(12), 180);
  assert.equal(lines.join(" "), words.join(" "));
});

test("fitText picks the largest size that fits both width and height", () => {
  // "HELLO" is 5 chars. In a 300x200 box at lineHeight 1.05:
  // size 120 -> width 300 (fits exactly), height 126 (fits). It wins because
  // 132 would be 330 wide and overflow.
  const result = fitText("HELLO", { w: 300, h: 200 }, TITLE_SIZES, measureAt);
  assert.equal(result.overflowed, false);
  assert.equal(result.fontSize, 120);
  assert.deepEqual(result.lines, ["HELLO"]);
});

test("fitText falls back to the smallest size and flags overflow", () => {
  // A 10px-wide box cannot hold any word at any candidate size.
  const smallest = Math.min(...TITLE_SIZES);
  const result = fitText("IMPOSSIBLE", { w: 10, h: 10 }, TITLE_SIZES, measureAt);
  assert.equal(result.overflowed, true);
  assert.equal(result.fontSize, smallest);
  // Still returns the text — an overflowing render beats a blank one.
  assert.deepEqual(result.lines, ["IMPOSSIBLE"]);
});

test("fitText handles empty and whitespace-only titles without overflowing", () => {
  for (const input of ["", "   ", "\n\t "]) {
    const result = fitText(input, { w: 300, h: 200 }, TITLE_SIZES, measureAt);
    assert.deepEqual(result.lines, []);
    assert.equal(result.overflowed, false);
  }
});
