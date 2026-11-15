// Feed tests computed from the real thumbnail pixels in the browser. No AI, no cost.
// These are the soul.md checks (§4 cover/grayscale/phone test, §10 dark and light feed)
// expressed as numbers a person can read. They describe the image, not predicted CTR.

export type FeedCheck = {
  /** Luminance contrast between the thumbnail's outer frame and each feed background (WCAG ratio). */
  edgeOnDark: number;
  edgeOnLight: number;
  /** Spread of brightness inside the image (p95 − p5 of relative luminance, 0–1). Low = flat in grayscale. */
  tonalRange: number;
  /** Share of the image that is strongly saturated (0–1). */
  vivid: number;
};

const DARK_FEED = 0x0f / 255; // YouTube dark #0f0f0f
const LIGHT_FEED = 1; // YouTube light #ffffff

function lin(c: number) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function luminance(r: number, g: number, b: number) { return 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255); }
export function contrastRatio(a: number, b: number) { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); }

export function analyzePixels(data: Uint8ClampedArray, width: number, height: number): FeedCheck {
  const lums: number[] = [];
  let edgeSum = 0, edgeCount = 0, vividCount = 0;
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.06));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const l = luminance(r, g, b);
    lums.push(l);
    if (x < band || y < band || x >= width - band || y >= height - band) { edgeSum += l; edgeCount++; }
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 60 && (max - min) / max > 0.55) vividCount++;
  }
  lums.sort((a, b) => a - b);
  const p = (q: number) => lums[Math.min(lums.length - 1, Math.floor(q * lums.length))];
  const edge = edgeCount ? edgeSum / edgeCount : 0;
  const darkL = lin(DARK_FEED), lightL = LIGHT_FEED;
  return {
    edgeOnDark: Math.round(contrastRatio(edge, darkL) * 10) / 10,
    edgeOnLight: Math.round(contrastRatio(edge, lightL) * 10) / 10,
    tonalRange: Math.round((p(0.95) - p(0.05)) * 100) / 100,
    vivid: Math.round((vividCount / Math.max(1, lums.length)) * 100) / 100,
  };
}

export type Verdict = { id: "dark" | "light" | "grayscale"; label: string; pass: boolean; detail: string };

// Thresholds are conservative readability heuristics, not YouTube rules.
export function verdicts(c: FeedCheck): Verdict[] {
  return [
    { id: "dark", label: "Stands out on dark feed", pass: c.edgeOnDark >= 1.4, detail: c.edgeOnDark >= 1.4 ? "The edges separate from the dark background." : "The edges are close to the dark background; the thumbnail may blend in." },
    { id: "light", label: "Stands out on light feed", pass: c.edgeOnLight >= 1.4, detail: c.edgeOnLight >= 1.4 ? "The edges separate from the white background." : "The edges are close to white; the thumbnail may wash out." },
    { id: "grayscale", label: "Still reads in grayscale", pass: c.tonalRange >= 0.35, detail: c.tonalRange >= 0.35 ? "Light and dark areas stay distinct without color." : "Without color the image turns flat; add light/dark contrast to the subject or text." },
  ];
}

export async function checkImage(src: string, sample = 96): Promise<FeedCheck> {
  const img = new Image();
  // Signed storage URLs are cross-origin; without this the canvas is tainted and every check is skipped.
  if (/^https?:/.test(src) && new URL(src, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const scale = sample / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return analyzePixels(ctx.getImageData(0, 0, w, h).data, w, h);
}
