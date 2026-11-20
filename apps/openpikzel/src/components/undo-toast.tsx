"use client";
import { useEffect, useRef, useState } from "react";
export function UndoToast({ message, onUndo, onPause, onResume, items }: { message: string; onUndo: () => void; onPause: (reason: string) => void; onResume: (reason: string) => void; items?: { id:string; name:string; undo:()=>void }[] }) {
  const [pausedBy, setPausedBy] = useState<Set<string>>(() => new Set());
  const resumeRef = useRef(onResume); resumeRef.current = onResume;
  useEffect(() => () => { resumeRef.current("hover"); resumeRef.current("focus"); }, []);
  const ids = items?.map(item => item.id).join("\0") ?? "";
  useEffect(() => { for (const reason of pausedBy) onPause(reason); }, [ids, pausedBy]);
  const change = (reason: string, paused: boolean) => { setPausedBy(current => { const next = new Set(current); if (paused) next.add(reason); else next.delete(reason); return next; }); if (paused) onPause(reason); else onResume(reason); };
  return <div className="undo-toast" role="status" onMouseEnter={()=>change("hover",true)} onMouseLeave={()=>change("hover",false)} onFocus={()=>change("focus",true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) change("focus",false); }}><span>{message}</span><button type="button" className="neutral-button" onClick={onUndo}>{items && items.length>1 ? "Undo all" : "Undo"}</button>{items && items.length>1 && <details><summary>Show items</summary>{items.map(item=><div key={item.id}>{item.name} <button type="button" onClick={item.undo}>Undo</button></div>)}</details>}</div>;
}
