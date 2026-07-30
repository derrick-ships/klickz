"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_W, CANVAS_H, fontById, type ThumbSpec } from "@/lib/templates.ts";
import { render } from "@/lib/render.ts";
import { PillButton } from "./ui";

/** Loads a data URL into a decoded <img>, or null when there is nothing to load. */
function useImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImg(image);
    };
    image.onerror = () => {
      if (!cancelled) setImg(null);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return img;
}

export default function Preview({ spec }: { spec: ThumbSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontsReady, setFontsReady] = useState(false);

  const person = useImage(spec.person.src);
  const logo = useImage(spec.logo.src);
  const background = useImage(spec.backgroundSrc);

  const font = fontById(spec.fontId);

  // Canvas silently falls back to a default face if the webfont has not landed,
  // so wait for the specific family before drawing with it.
  useEffect(() => {
    let cancelled = false;
    setFontsReady(false);
    const wanted = `${font.weight} 100px "${font.family}"`;
    Promise.all([
      document.fonts.load(wanted),
      document.fonts.load('700 26px "Inter"'),
    ])
      .then(() => {
        if (!cancelled) setFontsReady(true);
      })
      .catch(() => {
        // A failed webfont should degrade to the system face, not a blank canvas.
        if (!cancelled) setFontsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [font.family, font.weight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    render(ctx, spec, { person, logo, background });
  }, [spec, person, logo, background, fontsReady]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug =
        spec.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "thumbnail";
      a.href = url;
      a.download = `klickz-${slug}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [spec.title]);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="relative w-full max-w-[1024px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full rounded-[15px] border border-hairline-soft shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
        />
        <span className="absolute top-3 right-3 rounded-full bg-canvas/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted backdrop-blur">
          {CANVAS_W} × {CANVAS_H}
        </span>
      </div>

      <PillButton onClick={download}>Download PNG</PillButton>
    </div>
  );
}
