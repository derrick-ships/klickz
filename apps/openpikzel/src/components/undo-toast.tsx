"use client";
export function UndoToast({ message, onUndo, onPause, onResume, items }: { message: string; onUndo: () => void; onPause: () => void; onResume: () => void; items?: { id:string; name:string; undo:()=>void }[] }) {
  return <div className="undo-toast" role="status" onMouseEnter={onPause} onMouseLeave={onResume} onFocus={onPause} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) onResume(); }}><span>{message}</span><button type="button" className="neutral-button" onClick={onUndo}>{items && items.length>1 ? "Undo all" : "Undo"}</button>{items && items.length>1 && <details><summary>Show items</summary>{items.map(item=><div key={item.id}>{item.name} <button type="button" onClick={item.undo}>Undo</button></div>)}</details>}</div>;
}
