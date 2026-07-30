"use client";

import { useEffect, useRef } from "react";
import {
  CANVAS_W,
  CANVAS_H,
  TEMPLATES,
  TEXT_EFFECTS,
  FONTS,
  SWATCHES,
  templateById,
  type ThumbSpec,
  type TextEffectId,
  type LogoPosition,
} from "@/lib/templates.ts";
import { fileToImageDataUrl, type Person } from "@/lib/people.ts";
import {
  RailSection,
  Slider,
  Toggle,
  Segmented,
  TextField,
  ColorField,
  SwatchGrid,
  UploadButton,
  FieldLabel,
} from "./ui";

/**
 * A real miniature of the template, painted by the same `paint` function the
 * full renderer uses. Scaling the context is far cheaper than maintaining a
 * second set of hand-drawn CSS previews that would drift the moment a
 * template changes.
 */
function TemplateCard({
  templateId,
  colors,
  active,
  onSelect,
}: {
  templateId: string;
  colors: ThumbSpec["colors"];
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tpl = templateById(templateId);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / CANVAS_W, canvas.height / CANVAS_H);
    tpl.paint(ctx, colors, false);

    // A suggestion of where the text and person land, so the cards read as
    // layouts rather than as colour swatches.
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(tpl.person.cx, tpl.person.bottom - 210, 140, 210, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(tpl.text.x, tpl.text.y + 40, tpl.text.w * 0.8, 46);
    ctx.fillRect(tpl.text.x, tpl.text.y + 110, tpl.text.w * 0.5, 30);
    ctx.restore();
  }, [tpl, colors]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-[10px] border p-1.5 text-left transition-colors ${
        active
          ? "border-white/60 bg-surface-2"
          : "border-transparent bg-surface-1 hover:bg-surface-2"
      }`}
    >
      <canvas
        ref={ref}
        width={192}
        height={108}
        className="w-full rounded-[6px]"
      />
      <span
        className={`mt-1.5 block text-[11px] font-medium ${
          active ? "text-ink" : "text-ink-muted"
        }`}
      >
        {tpl.name}
      </span>
    </button>
  );
}

export default function ControlRail({
  spec,
  setSpec,
  people,
  onSavePerson,
  onDeletePerson,
  onPickPerson,
}: {
  spec: ThumbSpec;
  setSpec: (updater: (prev: ThumbSpec) => ThumbSpec) => void;
  people: Person[];
  onSavePerson: () => void;
  onDeletePerson: (id: string) => void;
  onPickPerson: (person: Person) => void;
}) {
  const patch = (partial: Partial<ThumbSpec>) =>
    setSpec((prev) => ({ ...prev, ...partial }));

  return (
    <aside className="rail-scroll h-screen w-[380px] shrink-0 overflow-y-auto border-r border-hairline-soft bg-canvas">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-hairline-soft bg-canvas px-5">
        <span className="text-[15px] font-semibold tracking-[-0.02em]">
          Klickz
        </span>
        <span className="ml-2 text-[12px] text-ink-muted">thumbnail editor</span>
      </header>

      <RailSection label="Template">
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              templateId={t.id}
              colors={spec.colors}
              active={t.id === spec.templateId}
              onSelect={() => patch({ templateId: t.id })}
            />
          ))}
        </div>
      </RailSection>

      <RailSection label="Colors">
        <SwatchGrid
          swatches={SWATCHES}
          onPick={(s) => patch({ colors: { ...s } })}
        />
        <ColorField
          label="Background"
          value={spec.colors.bg}
          onChange={(bg) => patch({ colors: { ...spec.colors, bg } })}
        />
        <ColorField
          label="Accent"
          value={spec.colors.accent}
          onChange={(accent) => patch({ colors: { ...spec.colors, accent } })}
        />
        <ColorField
          label="Text"
          value={spec.colors.text}
          onChange={(text) => patch({ colors: { ...spec.colors, text } })}
        />
      </RailSection>

      <RailSection label="Text">
        <TextField
          label="Title"
          value={spec.title}
          placeholder="YOUR TITLE HERE"
          onChange={(title) => patch({ title })}
        />
        <TextField
          label="Subtitle"
          value={spec.subtitle}
          placeholder="Your subtitle goes here"
          onChange={(subtitle) => patch({ subtitle })}
        />
        <TextField
          label="Badge"
          value={spec.badge}
          placeholder="NEW"
          onChange={(badge) => patch({ badge })}
        />
      </RailSection>

      <RailSection label="Font">
        <select
          value={spec.fontId}
          onChange={(e) => patch({ fontId: e.target.value })}
          className="w-full rounded-[10px] bg-surface-1 px-3.5 py-2.5 text-[14px] text-ink"
          aria-label="Display font"
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </RailSection>

      <RailSection label="Text effect">
        <Segmented<TextEffectId>
          options={TEXT_EFFECTS}
          value={spec.effect}
          onChange={(effect) => patch({ effect })}
          columns={3}
        />
      </RailSection>

      <RailSection label="Person">
        <div className="mb-4">
          <Toggle
            label="Show person"
            checked={spec.person.show}
            onChange={(show) => patch({ person: { ...spec.person, show } })}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <UploadButton
            label={spec.person.src ? "Replace image" : "Upload"}
            onFile={async (file) => {
              const src = await fileToImageDataUrl(file);
              setSpec((prev) => ({
                ...prev,
                person: { ...prev.person, src, show: true },
              }));
            }}
          />
          {spec.person.src && (
            <button
              type="button"
              onClick={onSavePerson}
              className="rounded-full bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-hairline"
            >
              Save to library
            </button>
          )}
        </div>

        {people.length > 0 && (
          <div className="mb-4">
            <div className="mb-2">
              <FieldLabel>Saved people</FieldLabel>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {people.map((p) => (
                <div key={p.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onPickPerson(p)}
                    className={`block w-full overflow-hidden rounded-[8px] border transition-colors ${
                      spec.person.src === p.src
                        ? "border-white/60"
                        : "border-hairline hover:border-ink-muted"
                    }`}
                    title={p.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.src}
                      alt={p.name}
                      className="aspect-square w-full bg-surface-1 object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePerson(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[12px] leading-none text-ink-muted hover:text-ink group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Slider
          label="Scale"
          value={spec.person.scale}
          min={30}
          max={180}
          suffix="%"
          onChange={(scale) => patch({ person: { ...spec.person, scale } })}
        />
        <Slider
          label="Move X"
          value={spec.person.x}
          min={-400}
          max={400}
          suffix="px"
          onChange={(x) => patch({ person: { ...spec.person, x } })}
        />
        <Slider
          label="Move Y"
          value={spec.person.y}
          min={-300}
          max={300}
          suffix="px"
          onChange={(y) => patch({ person: { ...spec.person, y } })}
        />
      </RailSection>

      <RailSection label="Logo">
        <div className="mb-4">
          <Toggle
            label="Show logo"
            checked={spec.logo.show}
            onChange={(show) => patch({ logo: { ...spec.logo, show } })}
          />
        </div>

        <div className="mb-4">
          <UploadButton
            label={spec.logo.src ? "Replace logo" : "Upload"}
            onFile={async (file) => {
              const src = await fileToImageDataUrl(file, 300);
              setSpec((prev) => ({
                ...prev,
                logo: { ...prev.logo, src, show: true },
              }));
            }}
          />
        </div>

        <Slider
          label="Size"
          value={spec.logo.size}
          min={24}
          max={120}
          suffix="px"
          onChange={(size) => patch({ logo: { ...spec.logo, size } })}
        />
        <Slider
          label="Opacity"
          value={spec.logo.opacity}
          min={5}
          max={100}
          suffix="%"
          onChange={(opacity) => patch({ logo: { ...spec.logo, opacity } })}
        />
        <div className="mt-4">
          <div className="mb-2">
            <FieldLabel>Position</FieldLabel>
          </div>
          <Segmented<LogoPosition>
            options={[
              { id: "bottom-left", name: "Bottom L" },
              { id: "bottom-right", name: "Bottom R" },
              { id: "top-right", name: "Top R" },
            ]}
            value={spec.logo.position}
            onChange={(position) => patch({ logo: { ...spec.logo, position } })}
            columns={3}
          />
        </div>
      </RailSection>

      <RailSection label="Background image (optional)">
        <div className="flex items-center gap-2">
          <UploadButton
            label={spec.backgroundSrc ? "Replace" : "Upload"}
            onFile={async (file) => {
              const src = await fileToImageDataUrl(file, 720);
              patch({ backgroundSrc: src });
            }}
          />
          {spec.backgroundSrc && (
            <button
              type="button"
              onClick={() => patch({ backgroundSrc: null })}
              className="rounded-full bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </RailSection>

      <div className="px-5 py-6 text-[11px] leading-relaxed text-ink-muted">
        Internal tool. Everything stays in this browser — no account, nothing
        uploaded to a server.
      </div>
    </aside>
  );
}
