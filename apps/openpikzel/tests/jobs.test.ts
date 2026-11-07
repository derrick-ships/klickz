import { it, expect } from "vitest";
import { reserveJob, updateJob, ambiguousProviderError } from "../src/lib/jobs";
function fixture() {
  const rows = new Map<string, any>();
  const db: any = {
    from: () => {
      let op = "read",
        value: any,
        id = "";
      const q: any = {
        select: () => q,
        eq: (key: string, v: string) => {
          if (key === "id") id = v;
          return q;
        },
        maybeSingle: async () => ({ data: rows.get(id) || null, error: null }),
        insert: (v: any) => {
          op = "insert";
          value = v;
          return q;
        },
        update: (v: any) => {
          op = "update";
          value = v;
          return q;
        },
        then: (resolve: any) => {
          if (op === "insert") {
            if (rows.has(value.id))
              return Promise.resolve({ error: { code: "23505" } }).then(
                resolve,
              );
            rows.set(value.id, value);
          }
          if (op === "update") rows.set(id, { ...rows.get(id), ...value });
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  return { db, rows };
}
it("deduplicates concurrent paid requests and rejects changed payloads", async () => {
  const { db } = fixture();
  const results = await Promise.allSettled([
    reserveJob(db, "alice", "job", "generate", { prompt: "one" }, 1),
    reserveJob(db, "alice", "job", "generate", { prompt: "one" }, 1),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    reserveJob(db, "alice", "job", "generate", { prompt: "other" }, 1),
  ).rejects.toThrow("different");
});
it("replays a succeeded result but never redispatches a durable uncertain outcome", async () => {
  const { db } = fixture();
  await reserveJob(db, "alice", "job", "analyze", { title: "Actual title" }, 1);
  await updateJob(db, "alice", "job", "succeeded", { score: "saved" });
  expect(
    (
      await reserveJob(
        db,
        "alice",
        "job",
        "analyze",
        { title: "Actual title" },
        1,
      )
    ).replay,
  ).toEqual({ score: "saved" });
  await updateJob(db, "alice", "job", "reconciling");
  await expect(
    reserveJob(db, "alice", "job", "analyze", { title: "Actual title" }, 1),
  ).rejects.toThrow("already exists");
  expect(ambiguousProviderError(new Error("transport lost"))).toBe(true);
  expect(ambiguousProviderError({ status: 401 })).toBe(false);
  expect(ambiguousProviderError({ status: 408 })).toBe(true);
});
