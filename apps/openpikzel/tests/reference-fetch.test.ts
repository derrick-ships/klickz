import { it, expect, vi } from "vitest";
import https from "node:https";
import { EventEmitter } from "node:events";

// The pinned DNS lookup must answer both shapes Node uses: (host, {all:true}, cb) and (host, opts, cb).
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "142.251.149.6", family: 4 }] }));
it("pins the verified public address for callers that ask for all addresses", async () => {
  const seen: unknown[] = [];
  vi.spyOn(https, "get").mockImplementation(((_url: unknown, options: { lookup: (...a: unknown[]) => void }) => {
    options.lookup("i.ytimg.com", { all: true }, (...args: unknown[]) => seen.push(args));
    options.lookup("i.ytimg.com", { family: 4 }, (...args: unknown[]) => seen.push(args));
    const req = new EventEmitter() as EventEmitter & { destroy: (e?: Error) => void };
    req.destroy = () => {};
    setTimeout(() => req.emit("error", new Error("stop")), 0);
    return req;
  }) as never);
  const { fetchReference } = await import("../src/lib/reference");
  await expect(fetchReference("https://youtu.be/R1d0VZ0Hk4c")).rejects.toThrow("stop");
  expect(seen[0]).toEqual([null, [{ address: "142.251.149.6", family: 4 }]]);
  expect(seen[1]).toEqual([null, "142.251.149.6", 4]);
});
