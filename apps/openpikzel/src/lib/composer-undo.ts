export function scopedComposerUndo(origin: string | null, active: () => string | null, undo: () => void) {
  return () => { if (active() === origin) undo(); };
}
