import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverImages, reviewConcurrency } from "../src/lib/generation-delivery";
import type { Creation } from "../src/lib/types";

function item(id: string) {
  return { id, image_path: `${id}.png` } as Creation;
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("deliverImages", () => {
  it("caps in-flight reviews at reviewConcurrency of 2", async () => {
    expect(reviewConcurrency).toBe(2);
    const items = [item("a"), item("b"), item("c"), item("d")];
    const gates = new Map(items.map((creation) => [creation.id, deferred()]));
    let inFlight = 0,
      maxInFlight = 0;
    const started: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: items, partial: false }),
      review: async (creation) => {
        started.push(creation.id);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          await gates.get(creation.id)!.promise;
        } finally {
          inFlight--;
        }
      },
      current: () => true,
      onImages: () => {},
      onStage: () => {},
      holdMs: 60_000,
    });
    await flush();
    expect(started).toHaveLength(2);
    expect(maxInFlight).toBe(2);
    gates.get(started[0])!.resolve();
    await flush();
    expect(started).toHaveLength(3);
    expect(maxInFlight).toBe(2);
    for (const creation of items) gates.get(creation.id)!.resolve();
    await finished;
    expect(started).toHaveLength(4);
    expect(maxInFlight).toBe(2);
  });

  it("reveals images together with scores when every review finishes before holdMs", async () => {
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("a"), item("b")], partial: false }),
      review: async (creation) => {
        events.push(`review:${creation.id}`);
      },
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: (stage) => {
        events.push(stage);
      },
      holdMs: 5_000,
    });
    await finished;
    expect(events).toContain("a:scored");
    expect(events).toContain("b:scored");
    expect(events).toContain("review:a");
    expect(events).toContain("review:b");
    expect(events.indexOf("images")).toBeGreaterThan(events.indexOf("a:scored"));
    expect(events.indexOf("images")).toBeGreaterThan(events.indexOf("b:scored"));
    expect(events.at(-1)).toBe("ready");
  });

  it("calls onImages at the default 45s hold and fills in a late score afterwards", async () => {
    const slow = deferred();
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("fast"), item("slow")], partial: false }),
      review: (creation) => (creation.id === "slow" ? slow.promise : Promise.resolve()),
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: () => {},
    });
    await flush();
    expect(events).not.toContain("images");
    expect(events).toContain("fast:scored");
    expect(events).toContain("slow:pending");
    await vi.advanceTimersByTimeAsync(44_999);
    expect(events).not.toContain("images");
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toContain("images");
    expect(events).not.toContain("slow:scored");
    slow.resolve();
    await finished;
    expect(events).toContain("slow:scored");
    expect(events.indexOf("slow:scored")).toBeGreaterThan(events.indexOf("images"));
  });

  it("lets one failed review stand alone without blocking the others or the result", async () => {
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("ok"), item("bad"), item("also")], partial: false }),
      review: async (creation) => {
        if (creation.id === "bad") throw new Error("score did not finish");
      },
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: (stage) => {
        events.push(stage);
      },
      holdMs: 5_000,
    });
    const result = await finished;
    expect(result.creations.map((creation) => creation.id)).toEqual(["ok", "bad", "also"]);
    expect(events).toContain("images");
    expect(events).toContain("ok:scored");
    expect(events).toContain("also:scored");
    expect(events).toContain("bad:failed");
    expect(events).not.toContain("bad:scored");
  });

  it("stops onImages and onReview after the workspace changes mid-review", async () => {
    const hang = deferred();
    let current = true;
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("a"), item("b")], partial: false }),
      review: () => hang.promise,
      current: () => current,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: (stage) => {
        events.push(stage);
      },
      holdMs: 5_000,
    });
    await flush();
    const before = [...events];
    current = false;
    hang.resolve();
    await expect(finished).rejects.toThrow("workspace changed");
    expect(events).toEqual(before);
    expect(events).not.toContain("images");
    expect(events).not.toContain("a:scored");
    expect(events).not.toContain("b:scored");
  });

  it("skips scoring when no review function is provided", async () => {
    const events: string[] = [];
    const result = await deliverImages({
      generate: async () => ({ creations: [item("a"), item("b")], partial: false }),
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: (stage) => {
        events.push(stage);
      },
    });
    expect(result.creations).toHaveLength(2);
    expect(events).toEqual(["generating", "a:skipped", "b:skipped", "images", "image-ready"]);
  });

  it("reveals images immediately when onReview is omitted, before any review settles", async () => {
    const hang = deferred();
    let settled = false;
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("a"), item("b")], partial: false }),
      review: async () => {
        await hang.promise;
        settled = true;
      },
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onStage: (stage) => {
        events.push(stage);
      },
      holdMs: 45_000,
    });
    await flush();
    expect(events).toContain("images");
    expect(settled).toBe(false);
    hang.resolve();
    await finished;
    expect(settled).toBe(true);
    expect(events.at(-1)).toBe("ready");
  });

  it("marks every creation pending before the hold reveal, then scores them two at a time", async () => {
    const items = [item("a"), item("b"), item("c"), item("d")];
    const events: string[] = [];
    let inFlight = 0,
      maxInFlight = 0;
    const finished = deliverImages({
      generate: async () => ({ creations: items, partial: false }),
      review: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
        } finally {
          inFlight--;
        }
      },
      current: () => true,
      onImages: () => {
        events.push("images");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: () => {},
      holdMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(events).toContain("images");
    for (const creation of items) {
      expect(events).toContain(`${creation.id}:pending`);
      expect(events.indexOf(`${creation.id}:pending`)).toBeLessThan(events.indexOf("images"));
      expect(events).not.toContain(`${creation.id}:scored`);
    }
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await finished;
    for (const creation of items) expect(events).toContain(`${creation.id}:scored`);
    expect(maxInFlight).toBe(2);
  });

  it("lets in-flight reviews finish after onImages throws, but stops later onReview and onStage", async () => {
    const hang = deferred();
    let reviewFinished = false;
    const events: string[] = [];
    const finished = deliverImages({
      generate: async () => ({ creations: [item("a"), item("b")], partial: false }),
      review: async (creation) => {
        if (creation.id === "a") return;
        await hang.promise;
        reviewFinished = true;
      },
      current: () => true,
      onImages: () => {
        events.push("images");
        throw new Error("reveal failed");
      },
      onReview: (id, status) => {
        events.push(`${id}:${status}`);
      },
      onStage: (stage) => {
        events.push(stage);
      },
      holdMs: 10,
    });
    const rejected=expect(finished).rejects.toThrow("reveal failed");
    await flush();
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    const afterThrow = events.length;
    expect(events).toContain("images");
    hang.resolve();
    await flush();
    expect(reviewFinished).toBe(true);
    expect(events.slice(afterThrow)).toEqual([]);
    expect(events).not.toContain("b:scored");
  });
});
