/**
 * Thumbnail data model, font table, and the eight layout templates.
 *
 * Geometry is absolute against a fixed 1280x720 canvas. That is deliberate:
 * YouTube thumbnails are always this size, so a responsive coordinate system
 * would be abstraction with exactly one consumer.
 */

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export type Colors = { bg: string; accent: string; text: string };
export type Box = { x: number; y: number; w: number; h: number };
export type Align = "left" | "center";

/** Where the person is anchored: horizontal centre, baseline, target height. */
export type PersonAnchor = { cx: number; bottom: number; h: number };

export type LogoPosition = "bottom-left" | "bottom-right" | "top-right";

export type TextEffectId =
  | "none"
  | "outline"
  | "thick-outline"
  | "shadow"
  | "glow"
  | "block";

export const TEXT_EFFECTS: { id: TextEffectId; name: string }[] = [
  { id: "none", name: "None" },
  { id: "outline", name: "Outline" },
  { id: "thick-outline", name: "Thick Outline" },
  { id: "shadow", name: "Drop Shadow" },
  { id: "glow", name: "Glow" },
  { id: "block", name: "Block Shadow" },
];

export type FontDef = {
  id: string;
  name: string;
  /** CSS font-family as Google Fonts serves it. */
  family: string;
  weight: number;
};

/**
 * All open-source (Google Fonts). GT Walsheim from the design system is
 * licensed and unnecessary here — these are drawn onto the canvas, which is a
 * separate concern from the UI chrome (Inter). See DEC-001.
 */
export const FONTS: FontDef[] = [
  { id: "oswald", name: "Oswald", family: "Oswald", weight: 700 },
  { id: "anton", name: "Anton", family: "Anton", weight: 400 },
  { id: "bebas", name: "Bebas Neue", family: "Bebas Neue", weight: 400 },
  { id: "bigshoulders", name: "Big Shoulders", family: "Big Shoulders Display", weight: 800 },
  { id: "spartan", name: "League Spartan", family: "League Spartan", weight: 800 },
  { id: "montserrat", name: "Montserrat ExtraBold", family: "Montserrat", weight: 800 },
  { id: "poppins", name: "Poppins ExtraBold", family: "Poppins", weight: 800 },
  { id: "lato", name: "Lato Bold", family: "Lato", weight: 700 },
];

export function fontById(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export type ThumbSpec = {
  templateId: string;
  colors: Colors;
  title: string;
  subtitle: string;
  badge: string;
  fontId: string;
  effect: TextEffectId;
  person: {
    show: boolean;
    src: string | null;
    scale: number; // percent, 30-180
    x: number; // px offset, -400..400
    y: number; // px offset, -300..300
  };
  logo: {
    show: boolean;
    src: string | null;
    size: number; // px, 24-120
    opacity: number; // percent, 5-100
    position: LogoPosition;
  };
  backgroundSrc: string | null;
};

export const DEFAULT_SPEC: ThumbSpec = {
  templateId: "bold-split",
  colors: { bg: "#1a1a1a", accent: "#FF0000", text: "#FFFFFF" },
  title: "YOUR TITLE HERE",
  subtitle: "Your subtitle goes here",
  badge: "NEW",
  fontId: "anton",
  effect: "none",
  person: { show: true, src: null, scale: 100, x: 0, y: 0 },
  logo: { show: false, src: null, size: 50, opacity: 100, position: "bottom-left" },
  backgroundSrc: null,
};

/** Duotone presets. Mirrors the swatch row on the reference tool. */
export const SWATCHES: { bg: string; accent: string; text: string }[] = [
  { bg: "#1a1a1a", accent: "#FF0000", text: "#FFFFFF" },
  { bg: "#0b1e3d", accent: "#38BDF8", text: "#FFFFFF" },
  { bg: "#1a1a1a", accent: "#F97316", text: "#FFFFFF" },
  { bg: "#0a1f14", accent: "#4ADE80", text: "#FFFFFF" },
  { bg: "#1e1030", accent: "#A855F7", text: "#FFFFFF" },
  { bg: "#1a1a1a", accent: "#FACC15", text: "#111111" },
  { bg: "#2b0f14", accent: "#FB7185", text: "#FFFFFF" },
  { bg: "#0f172a", accent: "#7DD3FC", text: "#FFFFFF" },
  { bg: "#18181b", accent: "#EC4899", text: "#FFFFFF" },
  { bg: "#FFFFFF", accent: "#EF4444", text: "#111111" },
  { bg: "#FDF6EC", accent: "#EA8C1B", text: "#1a1a1a" },
  { bg: "#111111", accent: "#E7FB6B", text: "#111111" },
  { bg: "#FFFFFF", accent: "#111111", text: "#111111" },
  { bg: "#052e2b", accent: "#2DD4BF", text: "#FFFFFF" },
];

export type Template = {
  id: string;
  name: string;
  /**
   * Paints everything behind the person and text.
   * `hasBg` is true when the user supplied a background image, which is
   * already drawn by then — templates must not paint over it opaquely.
   */
  paint: (ctx: CanvasRenderingContext2D, c: Colors, hasBg: boolean) => void;
  text: Box;
  align: Align;
  person: PersonAnchor;
  /** Present only on templates that mask the person into a shape. */
  personClip?: { cx: number; cy: number; r: number };
  /** Overrides spec text colour where the template's identity demands it. */
  forceTextColor?: string;
};

/** Left-to-right scrim so light backgrounds don't eat left-aligned text. */
function leftScrim(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, CANVAS_W * 0.72, 0);
  g.addColorStop(0, "rgba(0,0,0,0.72)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function fillBase(ctx: CanvasRenderingContext2D, color: string, hasBg: boolean) {
  if (hasBg) return;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

export const TEMPLATES: Template[] = [
  {
    id: "bold-split",
    name: "Bold Split",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      ctx.fillStyle = c.accent;
      ctx.fillRect(0, 0, 742, CANVAS_H);
    },
    text: { x: 64, y: 150, w: 616, h: 430 },
    align: "left",
    person: { cx: 1000, bottom: CANVAS_H, h: 700 },
  },
  {
    id: "gradient-sweep",
    name: "Gradient Sweep",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      const g = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
      g.addColorStop(0, c.accent);
      g.addColorStop(0.55, hexToRgba(c.accent, 0.55));
      g.addColorStop(1, hexToRgba(c.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },
    text: { x: 64, y: 150, w: 620, h: 430 },
    align: "left",
    person: { cx: 1010, bottom: CANVAS_H, h: 700 },
  },
  {
    id: "diagonal-slash",
    name: "Diagonal Slash",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(820, 0);
      ctx.lineTo(600, CANVAS_H);
      ctx.lineTo(0, CANVAS_H);
      ctx.closePath();
      ctx.fill();
    },
    text: { x: 64, y: 160, w: 500, h: 410 },
    align: "left",
    person: { cx: 1010, bottom: CANVAS_H, h: 700 },
  },
  {
    id: "spotlight",
    name: "Spotlight",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      const g = ctx.createRadialGradient(
        CANVAS_W / 2, CANVAS_H * 0.42, 40,
        CANVAS_W / 2, CANVAS_H * 0.42, 560,
      );
      g.addColorStop(0, hexToRgba(c.accent, 0.85));
      g.addColorStop(0.55, hexToRgba(c.accent, 0.22));
      g.addColorStop(1, hexToRgba(c.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },
    text: { x: 190, y: 452, w: 900, h: 210 },
    align: "center",
    person: { cx: CANVAS_W / 2, bottom: CANVAS_H, h: 620 },
  },
  {
    id: "full-bleed",
    name: "Full Bleed",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      if (hasBg) leftScrim(ctx);
    },
    text: { x: 64, y: 150, w: 660, h: 430 },
    align: "left",
    person: { cx: 1000, bottom: CANVAS_H, h: 720 },
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    paint: (ctx, c, hasBg) => {
      // ponytail: this template forces its own light ground and dark ink.
      // That contrast IS its identity — honouring spec.colors here would
      // just make it a duplicate of Full Bleed.
      if (!hasBg) {
        ctx.fillStyle = "#F4F4F5";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
      ctx.fillStyle = c.accent;
      ctx.fillRect(72, 566, 210, 12);
    },
    text: { x: 72, y: 170, w: 620, h: 370 },
    align: "left",
    person: { cx: 1010, bottom: CANVAS_H, h: 680 },
    forceTextColor: "#0A0A0A",
  },
  {
    id: "banner-bar",
    name: "Banner Bar",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      ctx.fillStyle = c.accent;
      ctx.fillRect(0, 262, CANVAS_W, 196);
    },
    text: { x: 64, y: 286, w: 760, h: 148 },
    align: "left",
    person: { cx: 1058, bottom: CANVAS_H, h: 700 },
  },
  {
    id: "circle-frame",
    name: "Circle Frame",
    paint: (ctx, c, hasBg) => {
      fillBase(ctx, c.bg, hasBg);
      ctx.beginPath();
      ctx.arc(360, 360, 248, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(c.accent, 0.22);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = c.accent;
      ctx.stroke();
    },
    text: { x: 692, y: 200, w: 524, h: 330 },
    align: "left",
    person: { cx: 360, bottom: 608, h: 560 },
    personClip: { cx: 360, cy: 360, r: 241 },
  },
];

export function templateById(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** #rrggbb (or #rgb) plus an alpha, as an rgba() string canvas accepts. */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
