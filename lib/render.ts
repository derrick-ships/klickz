/**
 * Canvas renderer. Synchronous by design — every image and font must already
 * be loaded before this runs, which is the caller's job (components/Preview.tsx).
 * Keeping it synchronous means the preview redraws in one frame on every
 * keystroke, with no async tearing.
 */

import {
  CANVAS_W,
  CANVAS_H,
  templateById,
  fontById,
  hexToRgba,
  type ThumbSpec,
  type Template,
  type TextEffectId,
} from "./templates.ts";
import { fitText, TITLE_SIZES, SUBTITLE_SIZES } from "./layout.ts";

export type LoadedImages = {
  person: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  background: HTMLImageElement | null;
};

const BADGE_HEIGHT = 56;
const BADGE_GAP = 24;
const TITLE_LINE_HEIGHT = 1.02;
const SUBTITLE_LINE_HEIGHT = 1.25;
const TITLE_TO_SUBTITLE_GAP = 22;
const LOGO_MARGIN = 44;

/** Draws an image so it covers the box, cropping the overflow, never squashing. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;
  let dw: number;
  let dh: number;
  if (imgRatio > boxRatio) {
    dh = h;
    dw = h * imgRatio;
  } else {
    dw = w;
    dh = w / imgRatio;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: number,
  size: number,
  family: string,
) {
  ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
}

/**
 * Paints one line with the selected effect. Order matters in every branch:
 * strokes go down first so the fill sits cleanly on top, and shadows are
 * cleared afterwards so they never leak into the next draw call.
 */
function drawEffectText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  effect: TextEffectId,
  fill: string,
  accent: string,
  size: number,
) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  switch (effect) {
    case "outline":
      ctx.lineWidth = Math.max(3, size * 0.05);
      ctx.strokeStyle = "#000000";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      break;

    case "thick-outline":
      ctx.lineWidth = Math.max(8, size * 0.13);
      ctx.strokeStyle = "#000000";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      break;

    case "shadow":
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = size * 0.18;
      ctx.shadowOffsetX = size * 0.03;
      ctx.shadowOffsetY = size * 0.07;
      ctx.fillText(text, x, y);
      break;

    case "glow":
      ctx.shadowColor = accent;
      ctx.shadowBlur = size * 0.34;
      // Twice: canvas shadows are faint, and a second pass reads as a glow
      // rather than a smudge.
      ctx.fillText(text, x, y);
      ctx.fillText(text, x, y);
      break;

    case "block":
      ctx.fillStyle = hexToRgba("#000000", 0.85);
      ctx.fillText(text, x + size * 0.06, y + size * 0.06);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
      break;

    case "none":
    default:
      ctx.fillText(text, x, y);
      break;
  }

  ctx.restore();
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  spec: ThumbSpec,
  tpl: Template,
) {
  const targetH = tpl.person.h * (spec.person.scale / 100);
  const ratio = img.naturalWidth / img.naturalHeight;
  const h = targetH;
  const w = h * ratio;
  const cx = tpl.person.cx + spec.person.x;
  const bottom = tpl.person.bottom + spec.person.y;

  ctx.save();
  if (tpl.personClip) {
    ctx.beginPath();
    ctx.arc(tpl.personClip.cx, tpl.personClip.cy, tpl.personClip.r, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
  ctx.restore();
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  spec: ThumbSpec,
) {
  const h = spec.logo.size;
  const w = h * (img.naturalWidth / img.naturalHeight);

  let x = LOGO_MARGIN;
  let y = CANVAS_H - LOGO_MARGIN - h;
  if (spec.logo.position === "bottom-right") {
    x = CANVAS_W - LOGO_MARGIN - w;
  } else if (spec.logo.position === "top-right") {
    x = CANVAS_W - LOGO_MARGIN - w;
    y = LOGO_MARGIN;
  }

  ctx.save();
  ctx.globalAlpha = spec.logo.opacity / 100;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: "left" | "center",
) {
  const label = text.toUpperCase();
  setFont(ctx, 700, 26, "Inter");
  const padX = 24;
  const w = ctx.measureText(label).width + padX * 2;
  const left = align === "center" ? x - w / 2 : x;
  const r = BADGE_HEIGHT / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, y, w, BADGE_HEIGHT, r);
  // Near-black pill with white type: legible against every accent colour and
  // every template ground, including the light one.
  ctx.fillStyle = "#0A0A0A";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + padX, y + BADGE_HEIGHT / 2 + 1);
  ctx.restore();
}

/** Renders the full thumbnail. Clears first, so it is safe to call repeatedly. */
export function render(
  ctx: CanvasRenderingContext2D,
  spec: ThumbSpec,
  images: LoadedImages,
): void {
  const tpl = templateById(spec.templateId);
  const font = fontById(spec.fontId);
  const hasBg = Boolean(images.background);

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 1. Background image, then the template's own treatment on top of it.
  if (images.background) {
    drawCover(ctx, images.background, 0, 0, CANVAS_W, CANVAS_H);
  }
  tpl.paint(ctx, spec.colors, hasBg);

  // 2. Person sits behind the text, always — legibility beats layering tricks.
  if (spec.person.show && images.person) {
    drawPerson(ctx, images.person, spec, tpl);
  }

  // 3. Text stack: badge, title, subtitle, laid out top-down inside the box.
  const box = tpl.text;
  const textColor = tpl.forceTextColor ?? spec.colors.text;
  const anchorX = tpl.align === "center" ? box.x + box.w / 2 : box.x;
  let cursorY = box.y;

  if (spec.badge.trim()) {
    drawBadge(ctx, spec.badge.trim(), anchorX, cursorY, tpl.align);
    cursorY += BADGE_HEIGHT + BADGE_GAP;
  }

  const measureAtSize = (size: number, text: string) => {
    setFont(ctx, font.weight, size, font.family);
    return ctx.measureText(text).width;
  };

  // Reserve the subtitle's space before fitting the title, so a long subtitle
  // shrinks the title rather than overrunning the box.
  const remaining = box.y + box.h - cursorY;
  const subtitleFit = spec.subtitle.trim()
    ? fitText(
        spec.subtitle,
        { w: box.w, h: Math.min(150, remaining * 0.34) },
        SUBTITLE_SIZES,
        measureAtSize,
        SUBTITLE_LINE_HEIGHT,
      )
    : null;

  const subtitleHeight = subtitleFit
    ? subtitleFit.lines.length * subtitleFit.fontSize * SUBTITLE_LINE_HEIGHT
    : 0;

  const titleBoxH = Math.max(
    40,
    remaining - (subtitleHeight ? subtitleHeight + TITLE_TO_SUBTITLE_GAP : 0),
  );

  ctx.textAlign = tpl.align === "center" ? "center" : "left";
  ctx.textBaseline = "top";

  if (spec.title.trim()) {
    const titleFit = fitText(
      spec.title,
      { w: box.w, h: titleBoxH },
      TITLE_SIZES,
      measureAtSize,
      TITLE_LINE_HEIGHT,
    );
    setFont(ctx, font.weight, titleFit.fontSize, font.family);
    for (const line of titleFit.lines) {
      drawEffectText(
        ctx,
        line,
        anchorX,
        cursorY,
        spec.effect,
        textColor,
        spec.colors.accent,
        titleFit.fontSize,
      );
      cursorY += titleFit.fontSize * TITLE_LINE_HEIGHT;
    }
    cursorY += TITLE_TO_SUBTITLE_GAP;
  }

  if (subtitleFit && subtitleFit.lines.length) {
    setFont(ctx, font.weight, subtitleFit.fontSize, font.family);
    for (const line of subtitleFit.lines) {
      drawEffectText(
        ctx,
        line,
        anchorX,
        cursorY,
        // Glow on a small subtitle turns to mush — fall back to a clean fill.
        spec.effect === "glow" ? "none" : spec.effect,
        textColor,
        spec.colors.accent,
        subtitleFit.fontSize,
      );
      cursorY += subtitleFit.fontSize * SUBTITLE_LINE_HEIGHT;
    }
  }

  // 4. Logo last, so nothing paints over it.
  if (spec.logo.show && images.logo) {
    drawLogo(ctx, images.logo, spec);
  }
}
