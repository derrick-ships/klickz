import { expect, it, vi } from "vitest";
import { scopedComposerUndo } from "../src/lib/composer-undo";

it("does not restore a previous chat's composer into the active chat", () => {
  let active: string | null = "one";
  const undo = vi.fn();
  const action = scopedComposerUndo(active, () => active, undo);
  active = "two"; action(); expect(undo).not.toHaveBeenCalled();
  active = "one"; action(); expect(undo).toHaveBeenCalledOnce();
});
