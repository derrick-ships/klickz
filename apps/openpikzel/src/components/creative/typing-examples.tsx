"use client";
import { useEffect, useRef, useState } from "react";

// Approved exception 3 (DELIGHT.md): while the prompt is empty and unfocused, show
// example prompts typing in place of the placeholder so a first-time visitor sees
// what a good description looks like. Stops after 3 cycles, on focus, on typing,
// when the tab is hidden, and once the visitor has creations. Reduced motion shows
// one static example. The example is decorative: the textarea keeps its own
// placeholder for assistive tech, and "Use this example" fills the box.
export const promptExamples = [
  "A shocked creator holding a tiny phone next to a giant one, text “TOO BIG?”",
  "Before and after of a messy desk turned spotless, bright and clean",
  "A chef staring at a burnt cake, kitchen in smoke, text “WHAT WENT WRONG”",
  "A runner crossing a finish line at sunrise, arms up, warm orange light",
];
const TYPE_MS = 35, HOLD_MS = 2500, ERASE_MS = 14, MAX_CYCLES = 3;

export function TypingExamples({ active, onUse }: { active: boolean; onUse: (text: string) => void }) {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hide = () => { if (document.hidden) setStopped(true); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  useEffect(() => {
    if (!active || stopped) return;
    if (reduced.current) { setText(promptExamples[0]); return; }
    const total = promptExamples.length * MAX_CYCLES;
    let step = index, chars = 0, erasing = false;
    const tick = () => {
      const full = promptExamples[step % promptExamples.length];
      if (!erasing) {
        chars++;
        setText(full.slice(0, chars));
        if (chars >= full.length) {
          if (step + 1 >= total) { setIndex(step); return; }
          erasing = true;
          timer.current = setTimeout(tick, HOLD_MS);
          return;
        }
        timer.current = setTimeout(tick, TYPE_MS);
      } else {
        chars--;
        setText(full.slice(0, chars));
        if (chars <= 0) { erasing = false; step++; setIndex(step); timer.current = setTimeout(tick, 400); return; }
        timer.current = setTimeout(tick, ERASE_MS);
      }
    };
    timer.current = setTimeout(tick, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // index is only read at start so a restart resumes where it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stopped]);

  if (!active || !text) return null;
  const current = promptExamples[index % promptExamples.length];
  return (
    <div className="typing-examples" data-testid="typing-examples">
      <p className="typing-examples-text" aria-hidden="true">{text}<span className="typing-caret" /></p>
      <button type="button" className="typing-examples-use" onMouseDown={(e) => e.preventDefault()} onClick={() => onUse(current)}>
        Use this example
      </button>
    </div>
  );
}
