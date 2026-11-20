export function createDeleteQueue(commit: (id: string) => void, delay = 6000) {
  const entries = new Map<string, {timer: ReturnType<typeof setTimeout> | null; remaining: number; deadline: number; pausedBy: Set<string>}>();
  const start = (id: string) => {
    const entry = entries.get(id); if (!entry) return;
    entry.deadline = Date.now() + entry.remaining;
    entry.timer = setTimeout(() => { entries.delete(id); commit(id); }, entry.remaining);
  };
  return {
    add(id: string) { if (entries.has(id)) return false; entries.set(id, {timer:null, remaining:delay, deadline:0, pausedBy:new Set()}); start(id); return true; },
    undo(id: string) { const entry=entries.get(id); if (!entry) return false; if(entry.timer)clearTimeout(entry.timer);entries.delete(id);return true; },
    pause(id: string, reason = "default") { const entry=entries.get(id);if(!entry)return;entry.pausedBy.add(reason);if(!entry.timer)return;clearTimeout(entry.timer);entry.timer=null;entry.remaining=Math.max(0,entry.deadline-Date.now()); },
    resume(id: string, reason = "default") { const entry=entries.get(id);if(!entry)return;entry.pausedBy.delete(reason);if(!entry.timer && !entry.pausedBy.size)start(id); },
    deadline(id: string) { const entry=entries.get(id);return entry ? (entry.timer ? entry.deadline : Date.now()+entry.remaining) : null; },
    clear() { for(const entry of entries.values())if(entry.timer)clearTimeout(entry.timer);entries.clear(); },
  };
}
