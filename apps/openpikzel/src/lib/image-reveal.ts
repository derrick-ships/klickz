export const REVEAL_MS = 450, REVEAL_STAGGER_MS = 70, REVEAL_REDUCED_MS = 120;

export type RevealSurface = "canvas" | "card";
export type Arrival = { batch: number; index: number };

export function createArrivals() {
  let owner: string | null | undefined, sawLoading = false, known: Set<string> | null = null, batches = 0;
  const arrivals = new Map<string, Arrival>();
  return {
    observe(nextOwner: string | null, loading: boolean, ids: readonly string[]) {
      if (nextOwner !== owner) { owner = nextOwner; known = null; sawLoading = loading; arrivals.clear(); batches = 0; }
      if (loading) { sawLoading = true; return; }
      if (!sawLoading) return;
      if (!known) { known = new Set(ids); return; }
      const fresh = [...new Set(ids)].filter(id => !known!.has(id));
      if (!fresh.length) return;
      batches++;
      fresh.forEach((id, index) => { known!.add(id); arrivals.set(id, { batch: batches, index }); });
    },
    arrival(id: string | null | undefined): Arrival | null { return (id && arrivals.get(id)) || null; },
  };
}

export function staggerPositions(renderedIds: readonly string[], arrivalOf: (id: string) => Arrival | null): Map<string, number> {
  const seenPerBatch = new Map<number, number>(), positions = new Map<string, number>();
  for (const id of renderedIds) {
    if (positions.has(id)) continue;
    const arrival = arrivalOf(id);
    if (!arrival) continue;
    const index = seenPerBatch.get(arrival.batch) ?? 0;
    positions.set(id, index);
    seenPerBatch.set(arrival.batch, index + 1);
  }
  return positions;
}

export function createRevealRegistry() {
  let owner: string | null | undefined;
  const started = new Map<RevealSurface, Map<string, number>>();
  return {
    setOwner(nextOwner: string | null) {
      if (nextOwner !== owner) { owner = nextOwner; started.clear(); }
    },
    has(surface: RevealSurface, id: string) { return started.get(surface)?.has(id) ?? false; },
    startedAt(surface: RevealSurface, id: string) { return started.get(surface)?.get(id) ?? null; },
    claim(surface: RevealSurface, id: string, loaded: boolean, now: number) {
      if (!loaded || owner == null || started.get(surface)?.has(id)) return false;
      let surfaceStarts = started.get(surface);
      if (!surfaceStarts) { surfaceStarts = new Map(); started.set(surface, surfaceStarts); }
      surfaceStarts.set(id, now);
      return true;
    },
  };
}
export type RevealRegistry = ReturnType<typeof createRevealRegistry>;

export function planImageReveal(input: { surface: RevealSurface; id: string; arrived: boolean; uploaded: boolean; seen: RevealRegistry }): "reveal" | "static" {
  const { surface, id, arrived, uploaded, seen } = input;
  return arrived && !uploaded && !seen.has(surface, id) ? "reveal" : "static";
}

export function resumeDelay(input: { startedAt: number; now: number; index: number; reduced: boolean }): number | null {
  const { startedAt, now, index, reduced } = input;
  const delay = reduced ? 0 : index * REVEAL_STAGGER_MS, total = delay + (reduced ? REVEAL_REDUCED_MS : REVEAL_MS), elapsed = now - startedAt;
  return elapsed < total ? delay - elapsed : null;
}
