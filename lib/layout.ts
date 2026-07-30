/**
 * Pure text-layout logic.
 *
 * Deliberately knows nothing about canvas. Every width measurement arrives
 * through an injected function, which is the whole reason this file is
 * testable without a DOM — see lib/layout.test.ts.
 */

/** Measures the rendered width of a string at an already-established font. */
export type Measure = (text: string) => number;

/** Measures the rendered width of a string at a specific font size. */
export type MeasureAtSize = (size: number, text: string) => number;

/**
 * Greedy word wrap. Words never break mid-word: a single word wider than
 * `maxWidth` gets its own line and overflows, which is correct behaviour —
 * silently dropping or hyphenating it would be worse than a visible overflow
 * the user can fix by shortening the title.
 */
export function wrapWords(
  words: string[],
  measure: Measure,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export type FitResult = {
  lines: string[];
  fontSize: number;
  /** True when even the smallest candidate size overflowed the box. */
  overflowed: boolean;
};

/**
 * Picks the largest font size at which `text` fits inside a box.
 *
 * Walks `sizes` from largest to smallest and returns the first that fits both
 * the width (every wrapped line) and the height (line count x size x
 * lineHeight). If none fit, returns the smallest size with `overflowed: true`
 * so the caller can decide — the caller is better placed to judge whether to
 * clip, shrink the box, or just let it bleed.
 */
export function fitText(
  text: string,
  box: { w: number; h: number },
  sizes: number[],
  measureAtSize: MeasureAtSize,
  lineHeight = 1.05,
): FitResult {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return { lines: [], fontSize: sizes[sizes.length - 1] ?? 0, overflowed: false };
  }

  const descending = [...sizes].sort((a, b) => b - a);

  for (const size of descending) {
    const lines = wrapWords(words, (s) => measureAtSize(size, s), box.w);
    const totalHeight = lines.length * size * lineHeight;
    const widestLine = Math.max(...lines.map((l) => measureAtSize(size, l)));

    if (totalHeight <= box.h && widestLine <= box.w) {
      return { lines, fontSize: size, overflowed: false };
    }
  }

  const smallest = descending[descending.length - 1];
  return {
    lines: wrapWords(words, (s) => measureAtSize(smallest, s), box.w),
    fontSize: smallest,
    overflowed: true,
  };
}

/**
 * Descending candidate sizes for thumbnail titles. Coarse on purpose — a
 * 4px step is invisible at thumbnail scale and doubles the search cost.
 */
export const TITLE_SIZES = [132, 120, 110, 100, 92, 84, 76, 68, 60, 52, 46, 40];

/** Subtitles sit well below the title and need a much shorter ramp. */
export const SUBTITLE_SIZES = [48, 44, 40, 36, 32, 28, 24, 20];
