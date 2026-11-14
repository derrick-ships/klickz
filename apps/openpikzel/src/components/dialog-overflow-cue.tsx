"use client";
import { useEffect, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";

// Shows a "More below" cue at the bottom edge of the open dialog only while
// content continues past the visible area. It is decorative for pointer users;
// keyboard focus already scrolls content into view, so it is hidden from
// assistive technology and never takes focus.
export function DialogOverflowCue({ dialog, open }: { dialog: RefObject<HTMLDialogElement | null>; open: boolean }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) {
      setMore(false);
      return;
    }
    const update = () => setMore(node.scrollHeight - node.clientHeight - node.scrollTop > 8);
    update();
    const resize = new ResizeObserver(update);
    resize.observe(node);
    for (const child of Array.from(node.children)) resize.observe(child);
    const mutation = new MutationObserver(update);
    mutation.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, [dialog, open]);
  if (!more) return null;
  return (
    <div className="dialog-overflow-cue" aria-hidden="true" data-testid="dialog-overflow-cue">
      <span>
        More below <ChevronDown size={14} />
      </span>
    </div>
  );
}
