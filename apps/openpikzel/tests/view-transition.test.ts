import { afterEach, expect, it, vi } from "vitest";
import { withViewTransition } from "@/lib/view-transition";

const setup = (startViewTransition?: (cb: () => void) => unknown) => {
  vi.stubGlobal("document", { startViewTransition, querySelector: () => null });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
};
afterEach(() => vi.unstubAllGlobals());

it("runs the update once when the browser has no view transitions", () => {
  setup(undefined);
  const update = vi.fn();
  withViewTransition(update, "a");
  expect(update).toHaveBeenCalledOnce();
});

it("still opens the creation when startViewTransition throws", () => {
  setup(() => { throw new Error("busy"); });
  const update = vi.fn();
  withViewTransition(update, "a");
  expect(update).toHaveBeenCalledOnce();
});

it("applies the update exactly once when an aborted transition never runs its callback", async () => {
  setup(() => ({ finished: Promise.reject(new Error("aborted")) }));
  const update = vi.fn();
  withViewTransition(update, "a");
  await new Promise((r) => setTimeout(r, 0));
  expect(update).toHaveBeenCalledOnce();
});

it("applies the update exactly once when the callback ran and the transition finished", async () => {
  setup((cb) => { cb(); return { finished: Promise.resolve() }; });
  const update = vi.fn();
  withViewTransition(update, "a");
  await new Promise((r) => setTimeout(r, 0));
  expect(update).toHaveBeenCalledOnce();
});
