export type CompareScoreOptions = {
  name: string;
  empty: "Partial" | "Not assessed";
};

export function compareScore(
  previous: number | null,
  next: number | null,
  { name, empty }: CompareScoreOptions,
): { visible: string; spoken: string } {
  if (previous === null && next === null) {
    return { visible: empty, spoken: empty === "Partial" ? "Partial" : `${name} not assessed` };
  }
  if (previous === null || next === null) {
    const left = previous === null ? empty : String(previous);
    const right = next === null ? empty : String(next);
    const spoken =
      next === null
        ? `${name} ${empty === "Partial" ? "partial" : "not assessed"}, previously ${previous}`
        : `${name} ${next}, previously ${empty === "Partial" ? "partial" : "not assessed"}`;
    return { visible: `${left} → ${right}`, spoken };
  }
  if (previous === next) {
    return { visible: `${previous} → ${next}`, spoken: `${name} unchanged, at ${next}` };
  }
  const delta = next - previous;
  const signed = delta > 0 ? `+${delta}` : `${delta}`;
  const word = delta > 0 ? "up" : "down";
  return {
    visible: `${previous} → ${next} (${signed})`,
    spoken: `${name} ${word} ${Math.abs(delta)}, from ${previous} to ${next}`,
  };
}
