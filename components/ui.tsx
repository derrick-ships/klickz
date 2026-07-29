"use client";

import { useId, useRef } from "react";

/**
 * The control primitives DESIGN-framer.md does not specify.
 *
 * That file documents a marketing site — hero bands, pricing tiers, FAQ rows.
 * It has no slider, no toggle, no segmented control, because a marketing page
 * never needs one. These are authored to extend the same system rather than
 * import a component library: selection reads as SURFACE LIFT (canvas ->
 * surface-1 -> surface-2), never as a chromatic fill, and the signal blue
 * appears only on focus.
 */

export function RailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-hairline-soft px-5 py-5">
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
        {label}
      </h2>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-medium text-ink-muted">{children}</span>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id}>
          <FieldLabel>{label}</FieldLabel>
        </label>
        <span className="text-[12px] font-medium tabular-nums text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-[10px] py-1 text-left"
    >
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <span
        className={`relative h-[22px] w-[38px] rounded-full transition-colors ${
          checked ? "bg-ink" : "bg-hairline"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${
            checked ? "left-[19px] bg-canvas" : "left-[3px] bg-ink-muted"
          }`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: { id: T; name: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`rounded-[10px] px-2 py-2 text-[12px] font-medium transition-colors ${
              active
                ? "bg-surface-2 text-ink"
                : "bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="mb-3 last:mb-0">
      <label htmlFor={id} className="mb-1.5 block">
        <FieldLabel>{label}</FieldLabel>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] bg-surface-1 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/60"
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3 last:mb-0">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-9 shrink-0"
        aria-label={`${label} colour picker`}
      />
      <span className="flex-1 text-[13px] text-ink">{label}</span>
      <input
        type="text"
        defaultValue={value.toUpperCase()}
        onChange={(e) => {
          const next = e.target.value.trim();
          // Only push valid hex upward; otherwise the canvas renders black
          // mid-typing, which looks like a bug.
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(next)) onChange(next);
        }}
        key={value}
        className="w-[92px] rounded-[8px] bg-surface-1 px-2.5 py-1.5 text-right font-mono text-[12px] text-ink"
        aria-label={`${label} hex value`}
      />
    </div>
  );
}

export function SwatchGrid({
  swatches,
  onPick,
}: {
  swatches: { bg: string; accent: string; text: string }[];
  onPick: (s: { bg: string; accent: string; text: string }) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-7 gap-1.5">
      {swatches.map((s, i) => (
        <button
          key={`${s.bg}-${s.accent}-${i}`}
          type="button"
          onClick={() => onPick(s)}
          title={`${s.bg} / ${s.accent}`}
          className="aspect-square overflow-hidden rounded-[6px] border border-hairline"
          style={{
            background: `linear-gradient(135deg, ${s.accent} 0 50%, ${s.bg} 50% 100%)`,
          }}
        >
          <span className="sr-only">
            Use {s.accent} on {s.bg}
          </span>
        </button>
      ))}
    </div>
  );
}

export function UploadButton({
  label,
  accept = "image/*",
  onFile,
}: {
  label: string;
  accept?: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="rounded-full bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-hairline"
      >
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Reset so re-picking the same file still fires a change event.
          e.target.value = "";
        }}
      />
    </>
  );
}

export function PillButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const base =
    "rounded-full px-5 py-2.5 text-[14px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-white/90"
      : "bg-surface-1 text-ink hover:bg-surface-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}

export function Notice({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-5 mb-4 flex items-start justify-between gap-3 rounded-[10px] border border-hairline bg-surface-2 px-3.5 py-3"
    >
      <span className="text-[12px] leading-snug text-ink">{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-[12px] text-ink-muted hover:text-ink"
      >
        Dismiss
      </button>
    </div>
  );
}
