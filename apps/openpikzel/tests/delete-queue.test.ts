import { describe, expect, it, vi } from "vitest";
import { createDeleteQueue } from "../src/lib/delete-queue";

describe("delete queue", () => {
  it("keeps independent pause reasons until each is cleared", async () => {
    vi.useFakeTimers();
    const commit = vi.fn(); const queue = createDeleteQueue(commit);
    queue.add("chat"); queue.pause("chat", "hover"); queue.pause("chat", "focus");
    queue.resume("chat", "hover"); await vi.advanceTimersByTimeAsync(10000);
    expect(commit).not.toHaveBeenCalled();
    queue.resume("chat", "focus"); await vi.advanceTimersByTimeAsync(6000);
    expect(commit).toHaveBeenCalledExactlyOnceWith("chat");
    vi.useRealTimers();
  });
  it("commits only after six seconds and undo prevents commit", async () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const queue = createDeleteQueue(commit);
    queue.add("chat");
    await vi.advanceTimersByTimeAsync(5999);
    expect(commit).not.toHaveBeenCalled();
    expect(queue.undo("chat")).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(commit).not.toHaveBeenCalled();
    queue.add("chat");
    await vi.advanceTimersByTimeAsync(2000);
    queue.pause("chat");
    await vi.advanceTimersByTimeAsync(9000);
    expect(commit).not.toHaveBeenCalled();
    queue.resume("chat");
    await vi.advanceTimersByTimeAsync(4000);
    expect(commit).toHaveBeenCalledExactlyOnceWith("chat");
    expect(queue.undo("chat")).toBe(false);
    vi.useRealTimers();
  });
});
